import {
  IconBuildingSkyscraper,
  IconBolt,
  IconBuildingBank,
  IconGlassFull,
  IconTruck,
  IconCpu,
  IconShoppingBag,
  IconPlane,
  IconChartPie,
  IconShield,
  IconShieldOff,
  type IconProps,
} from "@tabler/icons-react";
import type { ComponentType } from "react";

// Sector id (and rating-family id) → Tabler icon, shared by the allocation legend
// and the 3D pillars. Rating families reuse this map so the "by rating" view
// resolves an icon too; ids never collide with sector slugs.
export const SECTOR_ICON: Record<string, ComponentType<IconProps>> = {
  property: IconBuildingSkyscraper,
  energy: IconBolt,
  finance: IconBuildingBank,
  food: IconGlassFull,
  logistics: IconTruck,
  tech: IconCpu,
  retail: IconShoppingBag,
  tourism: IconPlane,
  // Credit-rating families
  AAA: IconShield,
  AA: IconShield,
  A: IconShield,
  BBB: IconShield,
  BB: IconShield,
  B: IconShield,
  nonRate: IconShieldOff,
};

export const SECTOR_ICON_FALLBACK = IconChartPie;
