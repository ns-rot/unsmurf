// Package unsmurf builds the NationStates puppet dataset published by the
// unsmurf workflow.
//
// The package keeps the data pipeline separate from the CLI in cmd/unsmurf.
// Callers can use DefaultConfig and replace any Sheet.Source with a
// FileSource, BytesSource, or custom Source implementation to run offline or
// add additional sheets.
package unsmurf

import (
	"bytes"
	"compress/flate"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// DefaultUserAgent is sent to NationStates and Google Sheets by default.
const DefaultUserAgent = "script=ns-unsmurf-github by=rotenaple"

// Source provides the raw bytes for one sheet or API response.
//
// Sources are deliberately small so new data feeds can be added without
// touching the aggregation pipeline.
type Source interface {
	Fetch(ctx context.Context) ([]byte, error)
}

// SourceFunc adapts a function to the Source interface.
type SourceFunc func(ctx context.Context) ([]byte, error)

// Fetch implements Source.
func (f SourceFunc) Fetch(ctx context.Context) ([]byte, error) { return f(ctx) }

// FileSource reads a local file, transparently handling gzip-compressed files.
func FileSource(path string) Source {
	return SourceFunc(func(context.Context) ([]byte, error) {
		raw, err := os.ReadFile(path)
		if err != nil {
			return nil, err
		}
		return DecodeBody(raw)
	})
}

// BytesSource serves an in-memory payload. It is useful for tests and for
// callers that already downloaded a sheet themselves.
func BytesSource(raw []byte) Source {
	return SourceFunc(func(context.Context) ([]byte, error) {
		return DecodeBody(raw)
	})
}

// URLSource fetches a URL using Config.HTTP at run time. Calling Fetch
// directly outside Config uses a default HTTPClient.
type URLSource string

// Fetch implements Source.
func (u URLSource) Fetch(ctx context.Context) ([]byte, error) {
	return NewHTTPClient().Fetch(ctx, string(u))
}

// HTTPClient fetches URLs with a shared User-Agent and polite retries.
//
// Retries are deliberately conservative: Google Sheets is the main source and
// bursting or hammering it is not acceptable. The pipeline still fetches
// sheets sequentially.
type HTTPClient struct {
	Client        *http.Client
	UserAgent     string
	MaxRetries    int           // retries after the initial attempt; 0 disables retries (NewHTTPClient defaults to 4)
	BaseDelay     time.Duration // initial exponential backoff delay
	MaxDelay      time.Duration // cap for exponential backoff (default 8s)
	MaxRetryAfter time.Duration // safety cap for server-specified Retry-After / RateLimit-Reset (default 2m)
	Logger        *slog.Logger

	rateMu      sync.Mutex
	nextAllowed map[string]time.Time
}

// NewHTTPClient returns a client with defaults suitable for the aggregator.
func NewHTTPClient() *HTTPClient {
	return &HTTPClient{
		Client:        &http.Client{Timeout: 2 * time.Minute},
		UserAgent:     DefaultUserAgent,
		MaxRetries:    4,
		BaseDelay:     500 * time.Millisecond,
		MaxDelay:      8 * time.Second,
		MaxRetryAfter: 2 * time.Minute,
	}
}

// URL returns a Source backed by this HTTP client.
func (c *HTTPClient) URL(rawURL string) Source {
	return SourceFunc(func(ctx context.Context) ([]byte, error) {
		return c.Fetch(ctx, rawURL)
	})
}

func (c *HTTPClient) logger() *slog.Logger {
	if c != nil && c.Logger != nil {
		return c.Logger
	}
	return slog.Default()
}

// Fetch downloads rawURL and decompresses gzip bodies when necessary.
func (c *HTTPClient) Fetch(ctx context.Context, rawURL string) ([]byte, error) {
	return c.fetchWithUserAgent(ctx, rawURL, "")
}

func (c *HTTPClient) fetchWithUserAgent(ctx context.Context, rawURL, userAgentOverride string) ([]byte, error) {
	if c == nil {
		c = NewHTTPClient()
	}

	client := c.Client
	if client == nil {
		client = &http.Client{Timeout: 2 * time.Minute}
	}

	maxRetries := c.MaxRetries
	if maxRetries < 0 {
		maxRetries = 0
	}

	userAgent := userAgentOverride
	if userAgent == "" {
		userAgent = c.UserAgent
	}
	if userAgent == "" {
		userAgent = DefaultUserAgent
	}

	for attempt := 0; ; attempt++ {
		if err := ctx.Err(); err != nil {
			return nil, err
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("User-Agent", userAgent)
		req.Header.Set("Accept", "*/*")

		if !c.waitHostRateLimit(ctx, req.URL.Host) {
			return nil, ctx.Err()
		}

		res, err := client.Do(req)
		if err == nil {
			body, readErr := io.ReadAll(res.Body)
			_ = res.Body.Close()

			if readErr == nil && res.StatusCode >= http.StatusOK && res.StatusCode < http.StatusMultipleChoices {
				c.recordHostRateLimit(req.URL.Host, res)
				return DecodeBody(body)
			}

			status := res.StatusCode
			if readErr != nil {
				err = fmt.Errorf("%s: read response: %w", rawURL, readErr)
			} else {
				err = fmt.Errorf("%s: %s", rawURL, res.Status)
			}

			if ctx.Err() != nil {
				return nil, ctx.Err()
			}

			if attempt < maxRetries && (status == http.StatusTooManyRequests || status >= http.StatusInternalServerError || readErr != nil) {
				delay := c.retryDelay(res, attempt)
				c.logger().Warn("retrying request",
					"url", rawURL,
					"status", status,
					"attempt", attempt+1,
					"delay", delay,
					"error", err,
				)
				if !sleepContext(ctx, delay) {
					return nil, ctx.Err()
				}
				continue
			}

			return nil, err
		}

		if ctx.Err() != nil {
			return nil, ctx.Err()
		}

		if attempt < maxRetries {
			delay := c.retryDelay(nil, attempt)
			c.logger().Warn("retrying request",
				"url", rawURL,
				"attempt", attempt+1,
				"delay", delay,
				"error", err,
			)
			if !sleepContext(ctx, delay) {
				return nil, ctx.Err()
			}
			continue
		}

		return nil, err
	}
}

func (c *HTTPClient) maxRetryAfterDelay() time.Duration {
	if c.MaxRetryAfter > 0 {
		return c.MaxRetryAfter
	}
	if c.MaxDelay > 2*time.Minute {
		return c.MaxDelay
	}
	return 2 * time.Minute
}

func (c *HTTPClient) waitHostRateLimit(ctx context.Context, host string) bool {
	if host == "" {
		return true
	}
	c.rateMu.Lock()
	until := c.nextAllowed[host]
	c.rateMu.Unlock()

	delay := time.Until(until)
	if delay <= 0 {
		return true
	}
	return sleepContext(ctx, delay)
}

func (c *HTTPClient) recordHostRateLimit(host string, res *http.Response) {
	if host == "" || res == nil {
		return
	}
	remaining := strings.TrimSpace(res.Header.Get("RateLimit-Remaining"))
	if remaining == "" {
		remaining = strings.TrimSpace(res.Header.Get("X-RateLimit-Remaining"))
	}
	if remaining != "0" {
		return
	}

	delay, ok := parseRetryHeaders(res, "RateLimit-Reset", "X-RateLimit-Reset", "Retry-After", "X-Retry-After")
	if !ok || delay <= 0 {
		return
	}
	if capDelay := c.maxRetryAfterDelay(); delay > capDelay {
		delay = capDelay
	}
	until := time.Now().Add(delay + 250*time.Millisecond)

	c.rateMu.Lock()
	if c.nextAllowed == nil {
		c.nextAllowed = make(map[string]time.Time)
	}
	if until.After(c.nextAllowed[host]) {
		c.nextAllowed[host] = until
	}
	c.rateMu.Unlock()
}

func parseRetryHeaders(res *http.Response, headers ...string) (time.Duration, bool) {
	if res == nil {
		return 0, false
	}
	for _, header := range headers {
		value := strings.TrimSpace(res.Header.Get(header))
		if value == "" {
			continue
		}
		if seconds, err := strconv.Atoi(value); err == nil && seconds >= 0 {
			return time.Duration(seconds) * time.Second, true
		}
		if when, err := http.ParseTime(value); err == nil {
			delay := time.Until(when)
			if delay < 0 {
				delay = 0
			}
			return delay, true
		}
	}
	return 0, false
}

func (c *HTTPClient) retryDelay(res *http.Response, attempt int) time.Duration {
	if delay, ok := parseRetryHeaders(res, "Retry-After", "X-Retry-After", "RateLimit-Reset", "X-RateLimit-Reset"); ok {
		if capDelay := c.maxRetryAfterDelay(); delay > capDelay {
			delay = capDelay
		}
		if delay > 0 {
			delay += 250 * time.Millisecond
		}
		return delay
	}

	base := c.BaseDelay
	if base <= 0 {
		base = 500 * time.Millisecond
	}
	maximum := c.MaxDelay
	if maximum <= 0 {
		maximum = 8 * time.Second
	}

	shift := attempt
	if shift > 30 {
		shift = 30
	}
	delay := base << shift
	if delay <= 0 || delay > maximum {
		delay = maximum
	}
	if delay > 0 {
		delay += 250 * time.Millisecond
	}
	return delay
}

func sleepContext(ctx context.Context, delay time.Duration) bool {
	if delay <= 0 {
		return true
	}
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}

// DecodeBody handles the gzip bodies returned by some NationStates and Google
// endpoints. Plain payloads are returned unchanged.
func DecodeBody(raw []byte) ([]byte, error) {
	if len(raw) < 2 || raw[0] != 0x1f || raw[1] != 0x8b {
		return raw, nil
	}

	if reader, err := gzip.NewReader(bytes.NewReader(raw)); err == nil {
		data, readErr := io.ReadAll(reader)
		closeErr := reader.Close()
		if readErr == nil && closeErr == nil {
			return data, nil
		}
		// Truncated responses (for example a missing trailer) can still carry
		// the useful prefix. Keep it rather than throwing the whole response
		// away, matching the old scripts' partial-inflate fallback.
		if len(data) > 0 {
			return data, nil
		}
	}

	if len(raw) > 10 {
		reader := flate.NewReader(bytes.NewReader(raw[10:]))
		data, _ := io.ReadAll(reader)
		_ = reader.Close()
		if len(data) > 0 {
			return data, nil
		}
	}

	return nil, fmt.Errorf("cannot decompress gzip response (%d bytes)", len(raw))
}
