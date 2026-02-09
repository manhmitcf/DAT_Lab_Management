# EdgeSentinelAI API Documentation

> **Version:** 1.0.0  
> **Base URL:** `https://api.edgesentinel.ai/v1`  
> **Authentication:** Bearer Token (JWT)

---

## Overview

This document specifies the REST API endpoints required by the frontend. All responses use JSON format. All timestamps are in ISO 8601 format.

---

## 1. System Statistics

### `GET /stats`

Real-time system statistics for the Stats Bar.

**Response:**
```json
{
  "active_cameras": 12,
  "total_cameras": 14,
  "person_count": 104,
  "person_count_change": 5.2,
  "entry_today": 847,
  "exit_today": 743,
  "metadata_rate": 32.5,
  "inference_time": 12,
  "behavior_distribution": {
    "walking": 68,
    "standing": 24,
    "loitering": 5,
    "other": 3
  },
  "throughput": [45, 52, 48, 61, 55, 62, 58, 64, 71, 68]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `active_cameras` | int | Number of online cameras |
| `total_cameras` | int | Total registered cameras |
| `person_count` | int | Current occupancy count |
| `person_count_change` | float | % change from previous period |
| `entry_today` | int | Ingress count since 00:00 |
| `exit_today` | int | Egress count since 00:00 |
| `inference_time` | int | Average inference latency (ms) |

---

## 2. Alerts

### `GET /alerts`

List all alerts with optional filtering.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `type` | string | Filter: `critical`, `high`, `low` |
| `resolved` | bool | Filter by resolved status |
| `limit` | int | Max results (default: 50) |
| `offset` | int | Pagination offset |

**Response:**
```json
{
  "total": 128,
  "alerts": [
    {
      "id": "alert-001",
      "type": "critical",
      "event": "Fighting Detected",
      "icon": "sports_mma",
      "camera_id": "cam-04",
      "camera_name": "Camera 04",
      "location": "North Hallway",
      "timestamp": "2026-02-09T10:42:35Z",
      "confidence": 0.96,
      "resolved": false,
      "clip_url": "/clips/alert-001.mp4"
    }
  ]
}
```

### `PATCH /alerts/{id}`

Update alert status.

**Request:**
```json
{
  "resolved": true
}
```

---

## 3. Cameras

### `GET /cameras`

List all camera feeds.

**Response:**
```json
{
  "cameras": [
    {
      "id": "cam-01",
      "name": "CAM-01",
      "location": "Main Lobby",
      "rtsp_url": "rtsp://192.168.1.10:554/stream1",
      "status": "online",
      "resolution": "4K",
      "fps": 30
    }
  ]
}
```

| Status | Description |
|--------|-------------|
| `online` | Normal operation |
| `offline` | No connection |
| `heavy` | High load / degraded |
| `error` | Hardware/software error |

### `GET /cameras/{id}/stream`

WebSocket endpoint for live video stream (MJPEG/WebRTC).

---

## 4. Real-time Detections

### `WebSocket /ws/detections`

Real-time detection events stream.

**Message Format:**
```json
{
  "type": "detection",
  "data": {
    "id": "det-12345",
    "track_id": 42,
    "camera_id": "cam-01",
    "event": "Person Detected",
    "location": "Main Lobby",
    "confidence": 0.94,
    "bbox": { "x": 120, "y": 80, "width": 45, "height": 120 },
    "behavior": "walking",
    "timestamp": "2026-02-09T10:45:00.123Z"
  }
}
```

**Behavior Types:** `walking`, `standing`, `running`, `sitting`, `falling`, `loitering`, `fighting`

---

## 5. Floor Plan

### `GET /floorplan/markers`

Active entities on floor plan.

**Response:**
```json
{
  "markers": [
    {
      "id": 1,
      "x": 45.5,
      "y": 62.3,
      "type": "active",
      "label": "Person #42"
    },
    {
      "id": 2,
      "x": 78.2,
      "y": 45.1,
      "type": "alert",
      "label": "Incident"
    }
  ]
}
```

| Type | Description |
|------|-------------|
| `active` | Normal tracked entity |
| `inactive` | Entity not moving |
| `alert` | Entity associated with alert |

---

## 6. Analytics

### `GET /analytics`

Analytics data for dashboard.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `period` | string | `1h`, `today`, `7d`, `30d` |

**Response:**
```json
{
  "total_events": 12482,
  "events_change": 12.4,
  "avg_confidence": 98.2,
  "confidence_change": -0.5,
  "peak_time": "14:30",
  "peak_occupancy": 84,
  "peak_zone": "Main Atrium",
  "system_uptime": 99.9,
  "alert_distribution": {
    "loitering": { "count": 482, "percentage": 40 },
    "fall": { "count": 124, "percentage": 10 },
    "area_breach": { "count": 434, "percentage": 35 },
    "other": { "count": 200, "percentage": 15 }
  }
}
```

### `GET /analytics/occupancy-trends`

Hourly occupancy data for charts.

**Query:** `?period=today`

**Response:**
```json
{
  "data": [
    { "time": "00:00", "occupancy": 35, "ingress": 12, "egress": 8 },
    { "time": "01:00", "occupancy": 28, "ingress": 5, "egress": 12 },
    ...
  ]
}
```

### `GET /analytics/activity-heatmap`

Hourly activity intensity.

**Response:**
```json
{
  "data": [
    { "hour": 0, "intensity": 0.15 },
    { "hour": 1, "intensity": 0.08 },
    ...
  ]
}
```

---

## 7. Edge Devices

### `GET /devices`

List edge computing devices.

**Response:**
```json
{
  "devices": [
    {
      "id": "jetson-01",
      "name": "Jetson Nano 01",
      "type": "jetson",
      "status": "online",
      "cpu_load": 45,
      "ram_used": 2.1,
      "ram_total": 4,
      "fps": 32,
      "temperature": 42
    }
  ]
}
```

| Device Type | Description |
|-------------|-------------|
| `jetson` | NVIDIA Jetson |
| `raspberry` | Raspberry Pi |
| `server` | Edge Server |

---

## 8. Detection Activity

### `GET /detections/activity`

Historical detection counts for charts.

**Query:** `?interval=2h&period=24h`

**Response:**
```json
{
  "data": [
    { "time": "00:00", "count": 45 },
    { "time": "02:00", "count": 22 },
    ...
  ]
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

| HTTP Code | Error Code | Description |
|-----------|------------|-------------|
| 400 | `BAD_REQUEST` | Invalid parameters |
| 401 | `UNAUTHORIZED` | Missing/invalid token |
| 404 | `NOT_FOUND` | Resource not found |
| 500 | `INTERNAL_ERROR` | Server error |

---

## WebSocket Events Summary

| Endpoint | Event Types |
|----------|-------------|
| `/ws/detections` | `detection`, `alert`, `entry`, `exit` |
| `/ws/stats` | `stats_update` (every 1s) |
| `/ws/floorplan` | `marker_update`, `marker_remove` |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| REST APIs | 100 req/min |
| WebSocket | Unlimited (connection limit: 50) |
