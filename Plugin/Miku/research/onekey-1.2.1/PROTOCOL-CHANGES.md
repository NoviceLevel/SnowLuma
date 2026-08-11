# OneKey QQPet 1.2.0 to 1.2.1 changes

## Verified business changes

- Outdoor history remains `OidbSvcTrpcTcp.0x9876_1` with the same request and
  response fields. The update does not contain a different history endpoint.
- PK pacing is new: `pkDelayMinSeconds` and `pkDelayMaxSeconds` default to 60,
  are normalized, and are applied after starting a PK.
- PK candidate scan limit is capped at 100 and candidates are power-checked
  through `OidbSvcTrpcTcp.0x9ad4_1`.
- `adventure` is now accepted as an 8-hour or 12-hour fatigue action.
- Visiting now defaults to disabled, and `visitStompEnabled` is forcibly set to
  false during normalization. The released README attributes this to Tencent
  App-ID/login-state allow-list rejection.
- The business operation names for feed, bath, task, visit, stomp,
  encouragement, and PK remain visible, but their OIDB packet descriptors are
  no longer embedded in JavaScript.

## Architecture changes outside the pure business layer

- A distinct `mutationTransport` sends protected writes through the bundled
  native capability instead of the normal OneBot `send_packet` action.
- `WebResourceManager` obtains a signed/versioned UI resource manifest from
  `/v1/client/resources`, caches it for six hours, and blocks initialization
  when resources are unavailable.
- The local Web API now creates a random per-process bearer token, compares it
  with constant-time equality, verifies Host, Origin, and `Sec-Fetch-Site`, and
  only binds loopback hosts.
- Static-file traversal protection still checks path components after URL
  decoding. This should not be copied as-is to Miku without also normalizing
  Windows backslashes before joining paths.

## Practical conclusion for Miku

There is no new outdoor-history protobuf fix to port. Miku already uses the
correct `field 100 = 2`. The remaining history limitation is the SnowLuma/raw
packet transport policy, so the local settlement-history fallback remains
necessary until SnowLuma exposes an equivalent QQ native OIDB request path.

The useful portable changes are the PK delay range and the explicit disabling
of stomp. The protected native write transport, commercial license manager,
and remote resource gate are intentionally not candidates for migration.
