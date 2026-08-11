# OneKey QQPet 1.2.1 reverse-engineering artifact

This directory contains the readable QQPet business layer extracted from the
1.2.1 release at:

`onekey1.2.0/data/components/QQPet/index.mjs`

The original downloaded release was not modified or executed.

## Delivered files

- `index.business.mjs`: readable QQPet protocol and automation logic.
- `BUSINESS-FEATURE-INDEX.md`: entry-point index for the extracted code.
- `PROTOCOL-CHANGES.md`: verified 1.2.0 to 1.2.1 behavior and protocol changes.
- `OUTDOOR-HISTORY-PROTOCOL.md`: exact request and response layout for outdoor history.

The full intermediate deobfuscation files remain local in
`tmp-onekey-1.2.1`; they are not part of the product source.

## Source identity and verification

- Package version: `1.2.1`
- Build ID: `onebot-1.2.1-win-x64`
- Git commit recorded by the package: `85af6b297610`
- Original `index.mjs` size: 365,559 bytes
- Original SHA-256: `4cf0a6f366860fa457362e21565b1e5a975b1cedfb330a0216bd5475a6b57eda`
- Obfuscator marker: `javascript-obfuscator-5`
- Readable full-file syntax: verified with `node --check`
- Pure-business syntax: verified with `node --check`

## Scope

The extracted source includes configuration, progress persistence, protobuf
encoding/decoding, QQPet read and write request construction, response parsing,
and the automation controller.

It deliberately excludes the commercial license manager, activation-key
storage, remote resource gate, native protected-operation implementation, Web
UI server, and release bootstrap. Write requests remain behind an injected
`executeMutation` interface. No license bypass or protected native
implementation is included.
