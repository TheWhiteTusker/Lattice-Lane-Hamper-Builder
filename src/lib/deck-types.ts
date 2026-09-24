/** Deck size, colours and the info types slides are built from. */

export const SLIDE = { width: 1920, height: 1080 } as const;

export const DECK_COLORS = {
  green: "#b5c2b1", // the house deck's dusty pink, in Lattice Lane sage
  heading: "#595959",
  ink: "#1f1f1f",
  muted: "#7f7f7f",
  page: "#ffffff",
} as const;

export const DEFAULT_NOTE =
  "Pricing is applicable for an MOQ of 100 units. Estimated delivery: 15 working days from design approval and advance payment confirmation.";

export type Size = { width: number; height: number };
export type Photo = { url: string; size: Size };

export type DeckItemInfo = {
  product_id: string | null;
  name: string;
  /** Small line under the name, e.g. the product's category. */
  caption: string;
  image_url: string | null;
};

export type HamperInfo = {
  id: string;
  code: string;
  name: string;
  price: number | null;
  /** The hamper's own designed picture, used when no product has a photo. */
  image_url: string | null;
  items: DeckItemInfo[];
};

export type ProductInfo = {
  id: string;
  code: string;
  name: string;
  caption: string;
  price: number | null;
  image_url: string | null;
};

/** Looks up a loaded photo's natural size; undefined if it didn't load. */
export type SizeOf = (url: string) => Size | undefined;
