package unsmurf

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestUpdateNationStates(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/nations":
			_, _ = fmt.Fprint(writer, "<NATIONS>Yland,Zland,Alpha</NATIONS>")
		case "/members":
			_, _ = fmt.Fprint(writer, "<MEMBERS>Yland,Alpha</MEMBERS>")
		default:
			http.NotFound(writer, request)
		}
	}))
	defer server.Close()

	paths := PathsFor(filepath.Join(t.TempDir(), ".data"))
	config := Config{
		HTTP:   NewHTTPClient(),
		Logger: testLogger(),
		Paths:  paths,
		NationStates: NationStatesConfig{
			NationsURL:     server.URL + "/nations",
			MembersURL:     server.URL + "/members",
			MinNations:     2,
			MinWAMembers:   1,
			ArchiveQuality: 4,
		},
	}

	report, err := config.UpdateNationStates(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if report.Current != 3 || report.All != 3 || report.WA != 2 || !report.WAUpdated {
		t.Fatalf("unexpected report: %+v", report)
	}

	current, err := os.ReadFile(paths.CurrentNations)
	if err != nil {
		t.Fatal(err)
	}
	if string(current) != "alpha\nyland\nzland" {
		t.Fatalf("currentNations = %q", current)
	}

	archive, err := readNationsArchive(paths.AllNations, false)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(archive, []string{"alpha", "yland", "zland"}) {
		t.Fatalf("archive = %v", archive)
	}

	var currentJSON []string
	rawJSON, err := os.ReadFile(paths.CurrentNationsJSON())
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(rawJSON, &currentJSON); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(currentJSON, []string{"alpha", "yland", "zland"}) {
		t.Fatalf("currentNations.json = %v", currentJSON)
	}

	wa, err := readNationSet(paths.WANations)
	if err != nil {
		t.Fatal(err)
	}
	if len(wa) != 2 {
		t.Fatalf("WA set = %v", wa)
	}
	if _, ok := wa["yland"]; !ok {
		t.Fatalf("WA set missing yland: %v", wa)
	}
}

func TestUpdateNationStatesRejectsTruncatedList(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/nations":
			_, _ = fmt.Fprint(writer, "<NATIONS>only_one</NATIONS>")
		case "/members":
			_, _ = fmt.Fprint(writer, "<MEMBERS>only_one</MEMBERS>")
		default:
			http.NotFound(writer, request)
		}
	}))
	defer server.Close()

	config := Config{
		HTTP:   NewHTTPClient(),
		Logger: testLogger(),
		Paths:  PathsFor(filepath.Join(t.TempDir(), ".data")),
		NationStates: NationStatesConfig{
			NationsURL:   server.URL + "/nations",
			MembersURL:   server.URL + "/members",
			MinNations:   10,
			MinWAMembers: 10,
		},
	}

	if _, err := config.UpdateNationStates(context.Background()); err == nil {
		t.Fatal("expected truncated nations error")
	}
}

func TestUpdateNationStatesWithSources(t *testing.T) {
	paths := PathsFor(filepath.Join(t.TempDir(), ".data"))
	config := Config{
		Logger: testLogger(),
		Paths:  paths,
		NationStates: NationStatesConfig{
			NationsSource:  BytesSource([]byte("<NATIONS>Yland,Zland,Alpha</NATIONS>")),
			MembersSource:  BytesSource([]byte("<MEMBERS>Alpha</MEMBERS>")),
			MinNations:     2,
			MinWAMembers:   1,
			ArchiveQuality: 4,
		},
	}

	report, err := config.UpdateNationStates(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if report.Current != 3 || report.All != 3 || report.WA != 1 || !report.WAUpdated {
		t.Fatalf("unexpected report: %+v", report)
	}
}
