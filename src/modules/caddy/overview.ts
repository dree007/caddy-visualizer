import type { Db } from "@/server/db/client";

import { code } from "@/i18n/codes";

import {
  type GeneratedSitesCaddy,
  generateSitesCaddy,
  type GeneratorOptions,
  SiteGeneratorError,
} from "./generator";
import { listSites, type ManagedSite } from "./sites";

export type SitesPreview =
  { ok: true; generated: GeneratedSitesCaddy } | { ok: false; message: string };

export interface SitesOverview {
  /** All managed sites (enabled and disabled), ordered by hostname. */
  sites: ManagedSite[];
  /** `sites.caddy` as the generator would produce it from these sites. */
  preview: SitesPreview;
}

const PREVIEW_FAILED = code("overview.previewFailed");

/**
 * Read model of the config page: the stored sites plus the preview of the
 * generated configuration. The preview is produced by the real generator from
 * the same rows (it skips disabled sites itself); nothing is written anywhere.
 */
export async function loadSitesOverview(
  db: Db,
  options: GeneratorOptions = {},
): Promise<SitesOverview> {
  const sites = await listSites(db);
  return { sites, preview: previewOf(sites, options) };
}

function previewOf(
  sites: readonly ManagedSite[],
  options: GeneratorOptions,
): SitesPreview {
  try {
    return { ok: true, generated: generateSitesCaddy(sites, options) };
  } catch (error) {
    // Invalid rows (e.g. edited by hand) must not take down the whole page.
    if (error instanceof SiteGeneratorError) {
      return { ok: false, message: PREVIEW_FAILED };
    }
    throw error;
  }
}
