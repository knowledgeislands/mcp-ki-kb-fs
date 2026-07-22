/**
 * KB config orientation handler — returns the resolved zone map and raw
 * `.ki-config.toml` content for an agent bootstrapping against this KB.
 *
 * Reads from `Config` (loaded at startup), never from the filesystem at
 * tool-call time, so it is not subject to zone-scoping or protected-path guards.
 */
import type { Config } from '../../config/index.js'
import { jsonResult } from '../../utils/utils.js'

export const readKbConfig = (cfg: Config) => {
  return jsonResult({
    zones: {
      Calendar: cfg.zones.Calendar,
      Pillars: cfg.zones.Pillars,
      Resources: cfg.zones.Resources,
      Streams: cfg.zones.Streams,
      Admin: cfg.zones.Admin
    },
    staging: {
      inbound: cfg.zones.inbound,
      outbound: cfg.zones.outbound
    },
    rootFileAllowlist: cfg.rootFileAllowlist,
    kiConfigPresent: cfg.kiConfigRaw !== null,
    kiConfigRaw: cfg.kiConfigRaw ?? '(absent — all zones are defaults)'
  })
}
