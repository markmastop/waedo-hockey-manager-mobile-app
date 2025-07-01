# matches_live_events Table Plan

This plan outlines the structure and purpose of the upcoming `matches_live_events` table. The table will be used to persist all live events during a match for detailed post–match analysis and statistics.

## Purpose
- Store each match event as a single row rather than inside the `matches_live.events` JSON array.
- Provide an audit trail of every action in a match: substitutions, goals, cards, quarter starts/ends, etc.
- Allow efficient queries for analytics and reporting (per player, match, or event type).

## Proposed Columns
| Column         | Type                       | Description                                                            |
|---------------|---------------------------|------------------------------------------------------------------------|
| `id`          | `uuid` PK                 | Unique identifier for the event.                                       |
| `match_id`    | `uuid` FK `matches(id)`   | Reference to the match this event belongs to.                          |
| `player_id`   | `uuid` FK `players(id)`   | Optional reference to the player involved in the event.                |
| `team_id`     | `uuid` FK `teams(id)`     | Team responsible for the event (helps when player_id is null).         |
| `action`      | `text`                    | Type of event (goal, substitution, card, etc.).                        |
| `description` | `text`                    | Human readable description of the event.                               |
| `match_time`  | `integer`                 | Match clock time when the event occurred (in seconds).                 |
| `quarter`     | `integer`                 | Match quarter number.                                                  |
| `home_score`  | `integer`                 | Home team score after this event.                                    |
| `away_score`  | `integer`                 | Away team score after this event.                                    |
| `metadata`    | `jsonb`                   | Additional structured info (e.g. card color, position coordinates).    |
| `created_at`  | `timestamptz`             | Timestamp when the event was recorded.                                 |

## Indexes & Constraints
- Index on `match_id` for quick retrieval of events for a match.
- Index on `(match_id, player_id)` to filter events for a specific player in a match.
- GIN index on `metadata` for searching JSON fields when necessary.
- Foreign keys to ensure data integrity with related tables (`matches`, `players`, `teams`).

## Usage Considerations
- Use this table for any analytics or historical reporting rather than the transient `matches_live.events` column.
- A background job can periodically copy events from the JSON array into this table, or future code may write directly to this table when events occur.
- Functions such as `get_match_events_summary` and `get_player_event_stats` can be updated later to query this table for better performance.

