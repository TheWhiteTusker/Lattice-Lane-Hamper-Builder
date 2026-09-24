export type DisplayProduct = {
  id: string;
  url: string;
  name: string;
  category: string;
};

/**
 * Curated luxury gifting and bespoke hamper items that fill the scrolling
 * columns around the catalogue's own photos. Unsplash photo id, name, category;
 * w=360, q=75 keeps GPU texture and decode cost down.
 */
const CURATED: [photoId: string, name: string, category: string][] = [
  ["1549007994-cb92caebd54b", "Artisan Chocolate Truffles", "Gourmet Confections"],
  ["1514432324607-a09d9b4aefdd", "Handcrafted Ceramic Mug", "Artisanal Living"],
  ["1603006905003-be475563bc59", "Hand-Poured Amber Candle", "Home Fragrance"],
  ["1576092768241-dec231879fc3", "Single-Estate Darjeeling Tea", "Beverages"],
  ["1528751014936-863e6e7a319c", "Saffron Pistachios & Almonds", "Royal Dry Fruits"],
  ["1513885535751-8b9238bd345a", "Velvet Keepsake Hamper Box", "Packaging"],
  ["1551024709-8f23befc6f87", "Brushed Brass Barware Set", "Entertaining"],
  ["1559056199-641a0ac8b55e", "Monsoon Malabar Coffee Beans", "Specialty Roast"],
  ["1512909006721-3d6018887383", "Wax-Sealed Greeting Accents", "Finishing Touches"],
  ["1587049352846-4a222e784d38", "Organic Acacia Honey with Dipper", "Gourmet Pantry"],
  ["1616401784845-180882ba9ba8", "Bespoke Marble Coaster Quad", "Home Decor"],
  ["1556881286-fc6915169721", "Sparkling Botanical Elixir Flutes", "Celebration"],
  ["1606787366850-de6330128bfc", "Handmade Brass Keepsake Diya", "Festive Tokens"],
  ["1549465220-1a8b9238cd48", "Heritage Wooden Gift Trunk", "Signature Hampers"],
  ["1599599810769-bcde5a160d32", "Artisanal Hazelnut Brittle", "Sweet Delights"],
  ["1615529182904-14819c35db37", "Organic Belgian Linen Napkins", "Tableware"],
  ["1544716278-ca5e3f4abd8c", "Hand-Bound Leather Journal", "Stationery & Desk"],
  ["1569864358642-9d1684040f43", "Parisian Macaron Collection", "Patisserie"],
  ["1608248597359-0a6e0339a9ec", "Botanical Essential Oil Blend", "Wellness"],
  ["1596560548464-f010549b84d7", "Roasted Spiced Cashews Jar", "Savouries"],
  ["1578749556568-bc2c40e68b61", "Matte Ceramic Flora Bud Vase", "Artisanal Living"],
  ["1517256064527-09c73fc73e38", "Gilded Fine Bone China Cup", "Drinkware"],
  ["1544816155-12df9643f363", "Loom-Woven Willow Basket", "Packaging"],
  ["1606313564200-e75d5e30476c", "Single-Origin 72% Dark Chocolate", "Gourmet Confections"],
  ["1602928321679-560bb453f190", "Cedar & Bergamot Reed Diffuser", "Home Fragrance"],
  ["1558961363-fa8fdf82db35", "Cardamom & Almond Biscotti", "Bakery"],
  ["1529699211952-734e80c4d42b", "Rosewood Pocket Game Board", "Luxury Leisure"],
  ["1513201099705-a9746e1e201f", "Celebration Ribbon & Tag Kit", "Packaging"],
];

export const CURATED_FALLBACKS: DisplayProduct[] = CURATED.map(([photoId, name, category], i) => ({
  id: `f-${i + 1}`,
  url: `https://images.unsplash.com/photo-${photoId}?q=75&w=360&auto=format&fit=crop`,
  name,
  category,
}));
