package store

import (
	"sync"
	"time"
)

type Snapshot struct {
	Timestamp    time.Time `json:"timestamp"`
	POLBalance   float64   `json:"pol_balance"`
	USDCeBalance float64   `json:"usdc_e_balance"`
	PUSDBalance  float64   `json:"pusd_balance"`
	POLPrice     float64   `json:"pol_price"`
	TotalPUSD    float64   `json:"total_pusd"`
}

type Store struct {
	mu       sync.RWMutex
	entries  []Snapshot
	maxSize  int
}

func New(maxSize int) *Store {
	return &Store{
		entries: make([]Snapshot, 0, maxSize),
		maxSize: maxSize,
	}
}

func (s *Store) Add(snap Snapshot) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(s.entries) >= s.maxSize {
		s.entries = s.entries[1:]
	}
	s.entries = append(s.entries, snap)
}

func (s *Store) GetAll() []Snapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()

	out := make([]Snapshot, len(s.entries))
	copy(out, s.entries)
	return out
}

func (s *Store) Latest() *Snapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if len(s.entries) == 0 {
		return nil
	}
	latest := s.entries[len(s.entries)-1]
	return &latest
}
