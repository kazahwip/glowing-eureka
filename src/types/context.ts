import { Scenes } from "telegraf";
import type { BotKind, CardCategory, User } from "./entities";

export interface CardDraft {
  photos?: string[];
  category?: CardCategory;
  name?: string;
  age?: number;
  price1h?: number;
  price3h?: number;
  priceFullDay?: number;
  city?: string;
  description?: string;
}

export interface BroadcastDraft {
  audience?: "all" | "workers" | "clients";
  text?: string;
  photoFileId?: string;
}

export interface SearchDraft {
  category?: CardCategory;
  city?: string;
  page?: number;
}

export interface CuratorDraft {
  name?: string;
  telegramUsername?: string;
  description?: string;
  userTelegramId?: number;
  curatorId?: number;
}

export interface UserSearchDraft {
  query?: string;
}

export interface ProjectStatsDraft {
  totalProfits?: number;
  totalProfitAmount?: number;
  payoutPercent?: number;
}

export interface AdminProfitDraft {
  workerUserId?: number;
  workerLabel?: string;
  amount?: number;
}

export interface PaymentRequestDraft {
  amount?: number;
}

export interface AppSceneSessionData extends Scenes.WizardSessionData {
  cursor: number;
}

export interface AppSession extends Scenes.WizardSession<AppSceneSessionData> {
  cardDraft?: CardDraft;
  broadcastDraft?: BroadcastDraft;
  searchDraft?: SearchDraft;
  curatorDraft?: CuratorDraft;
  userSearchDraft?: UserSearchDraft;
  projectStatsDraft?: ProjectStatsDraft;
  adminProfitDraft?: AdminProfitDraft;
  paymentRequestDraft?: PaymentRequestDraft;
}

export interface AppContext extends Scenes.WizardContext<AppSceneSessionData> {
  session: AppSession;
  state: {
    user?: User;
    isAdmin?: boolean;
    botKind?: BotKind;
    targetUserId?: number;
  };
}

export function createDefaultSession(): AppSession {
  return {
    __scenes: {
      cursor: 0,
    },
  };
}
