


// ShadCN tailwind helper (optional if your components use it)
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// A helper for building page URLs
export function createPageUrl(page) {
  return `/pages/${page}`;
}



export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
