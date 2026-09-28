# CuratorOS Physical Device API v1

This document defines the stable API contract for ESP32, CYD, Pi, and other physical CuratorOS displays and sensors.

The purpose of this contract is to keep firmware independent from internal CuratorOS, Ops, Error Bus, Site Health, Speed, and Integrity implementation details.

## Canonical endpoints

### Read system/device status

`GET https://curator.oceanliners.net/api/device/v1/status`

Compatibility alias retained for already-flashed devices:

`GET https://curator.oceanliners.net/api/hardware-status`

### Send a device heartbeat

`POST https://ops.oceanlinercurator.com/api/device/v1/heartbeat`

Compatibility alias retained:

`POST https://ops.oceanlinercurator.com/api/heartbeat`

Authentication header:

`x-curator-ops-key`

The secret value remains device configuration and must never be committed to source control.

## Stable read contract

Firmware may rely on these fields for contract version 1:

- `contractVersion`
- `system.state`
- `system.publicSite`
- `system.activeIncidentCount`
- `system.highestIncidentSeverity`
- `devices.total`
- `devices.online`
- `devices.quiet`
- `devices.stale`
- `devices.unknown`
- `polling.recommendedSeconds`
- `polling.minimumSeconds`
- `heartbeat.endpoint`
- `heartbeat.method`
- `heartbeat.authHeader`

Other fields are richer diagnostic data and are not part of the minimal physical-device compatibility guarantee.

### System states

`system.state` uses:

- `healthy`
- `attention`
- `degraded`
- `partial`
- `unknown`

### Public-site states

`system.publicSite` uses:

- `online`
- `suspect`
- `offline`
- `unknown`

### Incident severity

`system.highestIncidentSeverity` uses:

- `p0`
- `p1`
- `p2`
- `none`

## Polling

Clients should normally use `polling.recommendedSeconds`.

Clients must not poll more frequently than `polling.minimumSeconds` unless a future contract version explicitly permits it.

Firmware should tolerate temporary read failures by retaining the last known state and visibly marking it stale/unknown rather than converting a network error into a confirmed service outage.

## Heartbeat request

The heartbeat body is JSON. The canonical fields are:

- `service` — required human-readable device/service label
- `deviceId` — stable unique device identifier
- `status` — normally `online`
- `version`
- `firmware`
- `commit`
- `runtime`
- `deviceClass`
- `board`
- `display`
- `wifiRssi`
- `batteryPercent`
- `powerSource`
- `charging`
- `maxAgeMinutes`
- `note`

Unknown fields should be omitted rather than fabricated.

Ops is the canonical heartbeat authority. Error Bus heartbeat endpoints remain available for older/specialist hardware but are not the general CuratorOS device-write contract.

## Compatibility rule

Contract version 1 is additive. Existing fields may gain new siblings, but the stable fields above must not change meaning or disappear without a new `contractVersion` and a compatibility period.

Existing unversioned compatibility endpoints remain supported for currently deployed hardware.
