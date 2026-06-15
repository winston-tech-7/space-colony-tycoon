import { Router } from "express";
import { GAME_MODES, parseStartApp } from "../modes/registry.js";
import { getStubMode } from "../modes/stubs.js";
import {
  ensureUser,
  feedCreatures,
  getProfile,
  getRareCreatures,
} from "../modes/colony/service.js";
import {
  createGuild,
  getGuildForUser,
  joinGuild,
  listTopGuilds,
  resolveExpiredWars,
  startGuildWar,
} from "../modes/guild/service.js";
import {
  buyWithCredits,
  cancelListing,
  createListing,
  getActiveListings,
  getUserListings,
} from "../modes/trading/service.js";
import {
  acceptChallenge,
  battleTurn,
  createChallenge,
  getBattle,
  getBattleLeaderboard,
  getPendingChallenges,
  getUserBattles,
} from "../modes/battle/service.js";
import {
  getAdmiralAdvice,
  getAdmiralHistory,
} from "../modes/admiral/service.js";
import { getQuests } from "../modes/loop/quests.js";
import {
  breedCreatures,
  crackEgg,
  getHuntState,
  getLeaderboard,
  huntOnce,
  listBreedCandidates,
  listEggs,
  spinWheel,
  syncEggStatuses,
} from "../modes/loop/service.js";
import {
  getPlanetEconomy,
  upgradeMine,
  upgradeBioLab,
  unlockPlanet,
  raidPlanet,
  upgradeCreature,
  upgradeEgg,
} from "../modes/planets/service.js";
import { telegramAuth, type AuthedRequest } from "./middleware/auth.js";

export const apiRouter = Router();

apiRouter.get("/modes", (_req, res) => {
  res.json({ modes: GAME_MODES });
});

apiRouter.get("/modes/:id/stub", (req, res) => {
  const stub = getStubMode(req.params.id as never);
  if (!stub) return res.status(404).json({ error: "Unknown mode" });
  res.json(stub);
});

apiRouter.get("/me", telegramAuth, async (req: AuthedRequest, res) => {
  const auth = req.telegramAuth!;
  const userId = BigInt(auth.user.id);
  await syncEggStatuses(userId);
  const profile = await ensureUser(
    userId,
    auth.user.first_name,
    auth.user.username,
  );
  const start = parseStartApp(auth.startParam);

  res.json({
    user: auth.user,
    startParam: auth.startParam,
    start,
    profile,
    modes: GAME_MODES,
  });
});

apiRouter.post("/colony/feed", telegramAuth, async (req: AuthedRequest, res) => {
  try {
    const result = await feedCreatures(BigInt(req.telegramAuth!.user.id));
    res.json(result);
  } catch (e) {
    res.status(429).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

apiRouter.get("/colony", telegramAuth, async (req: AuthedRequest, res) => {
  const profile = await getProfile(BigInt(req.telegramAuth!.user.id));
  res.json({ profile });
});

apiRouter.get("/planets", telegramAuth, async (req: AuthedRequest, res) => {
  const economy = await getPlanetEconomy(BigInt(req.telegramAuth!.user.id));
  res.json(economy);
});

apiRouter.post("/planets/unlock", telegramAuth, async (req: AuthedRequest, res) => {
  try {
    const { planetId } = req.body as { planetId?: string };
    if (!planetId) return res.status(400).json({ error: "planetId required" });
    const economy = await unlockPlanet(BigInt(req.telegramAuth!.user.id), planetId);
    res.json(economy);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

apiRouter.post("/planets/raid", telegramAuth, async (req: AuthedRequest, res) => {
  try {
    const { planetId } = req.body as { planetId?: string };
    if (!planetId) return res.status(400).json({ error: "planetId required" });
    const result = await raidPlanet(BigInt(req.telegramAuth!.user.id), planetId);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

apiRouter.post("/colony/mine/upgrade", telegramAuth, async (req: AuthedRequest, res) => {
  try {
    const { colonyId } = req.body as { colonyId?: number };
    if (!colonyId) return res.status(400).json({ error: "colonyId required" });
    const economy = await upgradeMine(BigInt(req.telegramAuth!.user.id), colonyId);
    res.json(economy);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

apiRouter.post("/colony/biolab/upgrade", telegramAuth, async (req: AuthedRequest, res) => {
  try {
    const { colonyId } = req.body as { colonyId?: number };
    if (!colonyId) return res.status(400).json({ error: "colonyId required" });
    const economy = await upgradeBioLab(BigInt(req.telegramAuth!.user.id), colonyId);
    res.json(economy);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

apiRouter.post("/creatures/upgrade", telegramAuth, async (req: AuthedRequest, res) => {
  try {
    const { creatureId } = req.body as { creatureId?: number };
    if (!creatureId) return res.status(400).json({ error: "creatureId required" });
    const profile = await upgradeCreature(BigInt(req.telegramAuth!.user.id), creatureId);
    res.json({ profile });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

apiRouter.post("/eggs/upgrade", telegramAuth, async (req: AuthedRequest, res) => {
  try {
    const { eggId } = req.body as { eggId?: number };
    if (!eggId) return res.status(400).json({ error: "eggId required" });
    const profile = await upgradeEgg(BigInt(req.telegramAuth!.user.id), eggId);
    res.json({ profile });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

apiRouter.get("/guild/me", telegramAuth, async (req: AuthedRequest, res) => {
  const membership = await getGuildForUser(BigInt(req.telegramAuth!.user.id));
  await resolveExpiredWars();
  res.json({ membership });
});

apiRouter.get("/guild/top", async (_req, res) => {
  const guilds = await listTopGuilds();
  res.json({ guilds });
});

apiRouter.post("/guild/create", telegramAuth, async (req: AuthedRequest, res) => {
  try {
    const { name, tag } = req.body as { name?: string; tag?: string };
    if (!name || !tag) return res.status(400).json({ error: "name and tag required" });
    const guild = await createGuild(
      BigInt(req.telegramAuth!.user.id),
      name,
      tag,
    );
    res.json({ guild });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

apiRouter.post("/guild/join", telegramAuth, async (req: AuthedRequest, res) => {
  try {
    const { tag } = req.body as { tag?: string };
    if (!tag) return res.status(400).json({ error: "tag required" });
    const guild = await joinGuild(BigInt(req.telegramAuth!.user.id), tag);
    res.json({ guild });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

apiRouter.post("/guild/war", telegramAuth, async (req: AuthedRequest, res) => {
  try {
    const membership = await getGuildForUser(BigInt(req.telegramAuth!.user.id));
    if (!membership) return res.status(400).json({ error: "Not in a guild" });
    const war = await startGuildWar(membership.guildId);
    res.json({ war });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

apiRouter.get("/market", async (_req, res) => {
  const listings = await getActiveListings();
  res.json({ listings });
});

apiRouter.get("/market/mine", telegramAuth, async (req: AuthedRequest, res) => {
  const listings = await getUserListings(BigInt(req.telegramAuth!.user.id));
  res.json({ listings });
});

apiRouter.post("/market/list", telegramAuth, async (req: AuthedRequest, res) => {
  try {
    const { creatureId, priceCredits, priceStars } = req.body as {
      creatureId?: number;
      priceCredits?: number;
      priceStars?: number;
    };
    const listing = await createListing(
      BigInt(req.telegramAuth!.user.id),
      creatureId!,
      priceCredits ?? 0,
      priceStars ?? 0,
    );
    res.json({ listing });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

apiRouter.post("/market/buy", telegramAuth, async (req: AuthedRequest, res) => {
  try {
    const { listingId } = req.body as { listingId?: number };
    const creature = await buyWithCredits(
      BigInt(req.telegramAuth!.user.id),
      listingId!,
    );
    res.json({ creature });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

apiRouter.delete("/market/:id", telegramAuth, async (req: AuthedRequest, res) => {
  try {
    await cancelListing(BigInt(req.telegramAuth!.user.id), Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

apiRouter.get("/creatures/rare", telegramAuth, async (req: AuthedRequest, res) => {
  const rares = await getRareCreatures(BigInt(req.telegramAuth!.user.id));
  res.json({ rares });
});

apiRouter.get("/battle", telegramAuth, async (req: AuthedRequest, res) => {
  const userId = BigInt(req.telegramAuth!.user.id);
  const [battles, pending, leaderboard] = await Promise.all([
    getUserBattles(userId),
    getPendingChallenges(userId),
    getBattleLeaderboard(),
  ]);
  res.json({ battles, pending, leaderboard });
});

apiRouter.get("/battle/:id", telegramAuth, async (req: AuthedRequest, res) => {
  try {
    const battle = await getBattle(Number(req.params.id));
    res.json({ battle });
  } catch (e) {
    res.status(404).json({ error: e instanceof Error ? e.message : "Not found" });
  }
});

apiRouter.post("/battle/challenge", telegramAuth, async (req: AuthedRequest, res) => {
  try {
    const { defenderId, creatureId } = req.body as {
      defenderId?: string | number;
      creatureId?: number;
    };
    if (!defenderId || !creatureId) {
      return res.status(400).json({ error: "defenderId and creatureId required" });
    }
    const battle = await createChallenge(
      BigInt(req.telegramAuth!.user.id),
      BigInt(defenderId),
      creatureId,
    );
    res.json({ battle });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

apiRouter.post("/battle/:id/accept", telegramAuth, async (req: AuthedRequest, res) => {
  try {
    const { creatureId } = req.body as { creatureId?: number };
    const battle = await acceptChallenge(
      BigInt(req.telegramAuth!.user.id),
      Number(req.params.id),
      creatureId!,
    );
    res.json({ battle });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

apiRouter.post("/battle/:id/turn", telegramAuth, async (req: AuthedRequest, res) => {
  try {
    const { action } = req.body as { action?: "attack" | "defend" };
    const battle = await battleTurn(
      BigInt(req.telegramAuth!.user.id),
      Number(req.params.id),
      action ?? "attack",
    );
    res.json({ battle });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

apiRouter.get("/admiral", telegramAuth, async (req: AuthedRequest, res) => {
  try {
    const result = await getAdmiralAdvice(BigInt(req.telegramAuth!.user.id));
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

apiRouter.post("/admiral", telegramAuth, async (req: AuthedRequest, res) => {
  try {
    const result = await getAdmiralAdvice(BigInt(req.telegramAuth!.user.id));
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

apiRouter.get("/admiral/history", telegramAuth, async (req: AuthedRequest, res) => {
  const history = await getAdmiralHistory(BigInt(req.telegramAuth!.user.id));
  res.json({ history });
});

apiRouter.get("/eggs", telegramAuth, async (req: AuthedRequest, res) => {
  const eggs = await listEggs(BigInt(req.telegramAuth!.user.id));
  res.json({ eggs });
});

apiRouter.post("/eggs/crack", telegramAuth, async (req: AuthedRequest, res) => {
  try {
    const { eggId, crackRequestId } = req.body as {
      eggId?: number;
      crackRequestId?: string;
    };
    if (!eggId || !crackRequestId) {
      return res.status(400).json({ error: "eggId and crackRequestId required" });
    }
    const result = await crackEgg(
      BigInt(req.telegramAuth!.user.id),
      eggId,
      crackRequestId,
    );
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

apiRouter.get("/breed/candidates", telegramAuth, async (req: AuthedRequest, res) => {
  const exclude = req.query.exclude ? Number(req.query.exclude) : undefined;
  const candidates = await listBreedCandidates(
    BigInt(req.telegramAuth!.user.id),
    exclude && !Number.isNaN(exclude) ? exclude : undefined,
  );
  res.json({ candidates });
});

apiRouter.post("/breed", telegramAuth, async (req: AuthedRequest, res) => {
  try {
    const { sessionId, parentAId, parentBId } = req.body as {
      sessionId?: string;
      parentAId?: number;
      parentBId?: number;
    };
    if (!sessionId || !parentAId || !parentBId) {
      return res.status(400).json({ error: "sessionId, parentAId, parentBId required" });
    }
    const result = await breedCreatures(
      BigInt(req.telegramAuth!.user.id),
      sessionId,
      parentAId,
      parentBId,
    );
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

apiRouter.post("/wheel/spin", telegramAuth, async (req: AuthedRequest, res) => {
  try {
    const { spinId } = req.body as { spinId?: string };
    if (!spinId) return res.status(400).json({ error: "spinId required" });
    const result = await spinWheel(BigInt(req.telegramAuth!.user.id), spinId);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

apiRouter.get("/hunt", telegramAuth, async (req: AuthedRequest, res) => {
  const state = await getHuntState(BigInt(req.telegramAuth!.user.id));
  res.json(state);
});

apiRouter.post("/hunt", telegramAuth, async (req: AuthedRequest, res) => {
  try {
    const result = await huntOnce(BigInt(req.telegramAuth!.user.id));
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

apiRouter.get("/quests", telegramAuth, async (req: AuthedRequest, res) => {
  const quests = await getQuests(BigInt(req.telegramAuth!.user.id));
  res.json({ quests });
});

apiRouter.get("/leaderboard", async (_req, res) => {
  const leaderboard = await getLeaderboard();
  res.json({ leaderboard });
});
