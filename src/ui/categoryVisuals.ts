import {
  ArrowLeftRight,
  Car,
  CircleQuestionMark,
  Clapperboard,
  Fuel,
  GraduationCap,
  HeartPulse,
  House,
  Lightbulb,
  Plane,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Utensils,
  Wallet,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

export type CategoryVisual = { Icon: LucideIcon; color: string };

/**
 * Vector icon + accent colour per default category id. The emoji stored in the DB `icon`
 * column is kept for data compatibility but the UI uses these.
 */
const VISUALS: Record<string, CategoryVisual> = {
  food: { Icon: Utensils, color: '#F97316' },
  groceries: { Icon: ShoppingCart, color: '#22C55E' },
  transport: { Icon: Car, color: '#0EA5E9' },
  fuel: { Icon: Fuel, color: '#EAB308' },
  shopping: { Icon: ShoppingBag, color: '#EC4899' },
  bills: { Icon: Lightbulb, color: '#F59E0B' },
  recharge: { Icon: Smartphone, color: '#6366F1' },
  rent: { Icon: House, color: '#8B5CF6' },
  health: { Icon: HeartPulse, color: '#EF4444' },
  entertainment: { Icon: Clapperboard, color: '#D946EF' },
  travel: { Icon: Plane, color: '#06B6D4' },
  education: { Icon: GraduationCap, color: '#3B82F6' },
  transfers: { Icon: ArrowLeftRight, color: '#64748B' },
  income: { Icon: Wallet, color: '#10B981' },
  uncategorized: { Icon: CircleQuestionMark, color: '#94A3B8' },
};

export function categoryVisual(id: string | null | undefined): CategoryVisual {
  return (id && VISUALS[id]) || VISUALS.uncategorized;
}
