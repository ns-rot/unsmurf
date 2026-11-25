package unsmurf

import (
	"bytes"
	"compress/gzip"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestDecodeBody(t *testing.T) {
	plain := []byte("plain text")
	if got, err := DecodeBody(plain); err != nil || !bytes.Equal(got, plain) {
		t.Fatalf("DecodeBody plain = %q, %v", got, err)
	}

	var buffer bytes.Buffer
	writer := gzip.NewWriter(&buffer)
	if _, err := writer.Write([]byte("compressed text")); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	got, err := DecodeBody(buffer.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "compressed text" {
		t.Fatalf("DecodeBody gzip = %q", got)
	}
}

func TestHTTPClientRetries(t *testing.T) {
	attempts := 0
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		attempts++
		if request.UserAgent() != DefaultUserAgent {
			t.Errorf("User-Agent = %q", request.UserAgent())
		}
		if attempts == 1 {
			writer.Header().Set("Retry-After", "0")
			writer.WriteHeader(http.StatusTooManyRequests)
			return
		}
		_, _ = writer.Write([]byte("ok"))
	}))
	defer server.Close()

	client := NewHTTPClient()
	client.Logger = testLogger()
	client.MaxRetries = 2
	client.BaseDelay = time.Millisecond
	client.MaxDelay = time.Millisecond

	data, err := client.Fetch(context.Background(), server.URL)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "ok" {
		t.Fatalf("body = %q", data)
	}
	if attempts != 2 {
		t.Fatalf("attempts = %d, want 2", attempts)
	}
}

func TestHTTPClientRetryDelayRespectsRetryAfterAboveMaxDelay(t *testing.T) {
	client := NewHTTPClient()
	client.MaxDelay = 8 * time.Second
	client.MaxRetryAfter = 2 * time.Minute

	res := &http.Response{Header: http.Header{"Retry-After": []string{"30"}}}
	delay := client.retryDelay(res, 0)
	want := 30*time.Second + 250*time.Millisecond
	if delay != want {
		t.Fatalf("retryDelay = %v, want %v", delay, want)
	}

	// Safety cap still applies.
	res = &http.Response{Header: http.Header{"X-Retry-After": []string{"999"}}}
	delay = client.retryDelay(res, 0)
	wantCap := 2*time.Minute + 250*time.Millisecond
	if delay != wantCap {
		t.Fatalf("capped retryDelay = %v, want %v", delay, wantCap)
	}
}

func TestHTTPClientZeroMaxRetriesDisablesRetries(t *testing.T) {
	attempts := 0
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		attempts++
		writer.WriteHeader(http.StatusTooManyRequests)
	}))
	defer server.Close()

	client := NewHTTPClient()
	client.Logger = testLogger()
	client.MaxRetries = 0

	if _, err := client.Fetch(context.Background(), server.URL); err == nil {
		t.Fatal("expected error")
	}
	if attempts != 1 {
		t.Fatalf("attempts = %d, want 1", attempts)
	}
}

func TestHTTPClientProactiveRateLimitWait(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		calls++
		if calls == 1 {
			writer.Header().Set("RateLimit-Remaining", "0")
			writer.Header().Set("RateLimit-Reset", "1")
		}
		_, _ = writer.Write([]byte("ok"))
	}))
	defer server.Close()

	client := NewHTTPClient()
	client.Logger = testLogger()

	if _, err := client.Fetch(context.Background(), server.URL); err != nil {
		t.Fatal(err)
	}

	// Second request with an already-short deadline should hit the proactive wait.
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	if _, err := client.Fetch(ctx, server.URL); err == nil {
		t.Fatal("expected proactive rate-limit wait to time out under 50ms deadline")
	}
	if calls != 1 {
		t.Fatalf("calls = %d, want 1 (blocked before second request)", calls)
	}
}
