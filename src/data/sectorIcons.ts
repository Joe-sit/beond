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
  type IconProps,
} from "@tabler/icons-react";
import type { ComponentType } from "react";

// Sector id → Tabler icon, shared by the allocation legend and the 3D pillars.
export const SECTOR_ICON: Record<string, ComponentType<IconProps>> = {
  property: IconBuildingSkyscraper,
  energy: IconBolt,
  finance: IconBuildingBank,
  food: IconGlassFull,
  logistics: IconTruck,
  tech: IconCpu,
  retail: IconShoppingBag,
  tourism: IconPlane,
};

export const SECTOR_ICON_FALLBACK = IconChartPie;
