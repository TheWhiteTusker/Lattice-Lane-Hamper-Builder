"use server";

import { restoreBinItem as restore } from "./bin-restore";
import {
  permanentlyDeleteBinItem as permDelete,
  emptyBinAction as emptyBin,
} from "./bin-delete";
import { purgeExpiredAction as purgeExpired } from "./bin-purge";
import type { BinItemType } from "./bin-types";

export async function restoreBinItem(id: string, type: BinItemType) {
  return restore(id, type);
}

export async function permanentlyDeleteBinItem(id: string, type: BinItemType) {
  return permDelete(id, type);
}

export async function emptyBinAction(type?: BinItemType) {
  return emptyBin(type);
}

export async function purgeExpiredAction() {
  return purgeExpired();
}
