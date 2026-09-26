export type BinItemType = "hamper" | "product" | "image";

export type BinItem = {
  id: string;
  type: BinItemType;
  title: string;
  code: string | null;
  subtitle: string | null;
  imageUrl: string | null;
  deletedAt: string;
  expiresAt: string;
  daysRemaining: number;
  metadata?: {
    productId?: string;
    productName?: string;
    productCode?: string;
    color?: string | null;
    storagePath?: string | null;
    collection?: string | null;
    status?: string | null;
    categoryName?: string | null;
    costPrice?: number | null;
    defaultSp?: number | null;
    finalCatalogueSp?: number | null;
    itemsCount?: number | null;
  };
};

export type BinCounts = {
  all: number;
  hampers: number;
  products: number;
  images: number;
  expired: number;
};

export type BinActionResult = {
  ok?: boolean;
  error?: string;
  message?: string;
};
