// Command unsmurf updates the NationStates and Google Sheets data published by
// the unsmurf GitHub Action.
package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"time"

	"github.com/ns-rot/unsmurf/pkg/unsmurf"
)

func main() {
	os.Exit(run())
}

func run() int {
	var (
		dataDir   = flag.String("data", ".data", "path to the data worktree")
		userAgent = flag.String("user-agent", unsmurf.DefaultUserAgent, "User-Agent sent to NationStates and Google")
		timeout   = flag.Duration("timeout", 2*time.Minute, "per-request HTTP timeout")
		workers   = flag.Int("workers", 0, "parallel regex workers (0 = CPU count, capped at 8)")
		verbose   = flag.Bool("v", false, "enable debug logging")
	)
	flag.Usage = func() {
		fmt.Fprintf(flag.CommandLine.Output(), "Usage: %s [flags] [nations|sheets|all]\n\n", os.Args[0])
		fmt.Fprintln(flag.CommandLine.Output(), "Commands:")
		fmt.Fprintln(flag.CommandLine.Output(), "  all       Update NationStates data and generate puppet data (default)")
		fmt.Fprintln(flag.CommandLine.Output(), "  nations   Update currentNations, currentWANations and allNations")
		fmt.Fprintln(flag.CommandLine.Output(), "  sheets    Generate puppetData.tsv, puppetData.json and conflicts")
		fmt.Fprintln(flag.CommandLine.Output())
		flag.PrintDefaults()
	}
	flag.Parse()

	if flag.NArg() > 1 {
		fmt.Fprintf(os.Stderr, "unexpected arguments: %v\n\n", flag.Args()[1:])
		flag.Usage()
		return 2
	}

	command := "all"
	if flag.NArg() == 1 {
		command = flag.Arg(0)
	}

	level := slog.LevelInfo
	if *verbose {
		level = slog.LevelDebug
	}
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level}))

	config := unsmurf.DefaultConfig()
	config.Logger = logger
	config.Paths = unsmurf.PathsFor(*dataDir)
	config.Workers = *workers
	config.HTTP.UserAgent = *userAgent
	config.HTTP.Logger = logger
	if config.HTTP.Client != nil {
		config.HTTP.Client.Timeout = *timeout
	}
	config.NationStates.UserAgent = *userAgent

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	switch command {
	case "nations", "fetch-nations":
		if _, err := config.UpdateNationStates(ctx); err != nil {
			logger.Error("nationstates update failed", "error", err)
			return 1
		}
	case "sheets", "fetch-sheets":
		if _, err := config.GeneratePuppetData(ctx); err != nil {
			logger.Error("puppet data generation failed", "error", err)
			return 1
		}
	case "all":
		if _, err := config.UpdateNationStates(ctx); err != nil {
			logger.Error("nationstates update failed", "error", err)
			return 1
		}
		if _, err := config.GeneratePuppetData(ctx); err != nil {
			logger.Error("puppet data generation failed", "error", err)
			return 1
		}
	default:
		flag.Usage()
		return 2
	}

	return 0
}
