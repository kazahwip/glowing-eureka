"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.teamCreateCardScene = void 0;
const telegraf_1 = require("telegraf");
const constants_1 = require("../../config/constants");
const views_1 = require("../../handlers/teambot/views");
const teambot_1 = require("../../keyboards/teambot");
const card_review_service_1 = require("../../services/card-review.service");
const cards_service_1 = require("../../services/cards.service");
const media_service_1 = require("../../services/media.service");
const validators_1 = require("../../utils/validators");
const CATEGORY_OPTIONS = [
    { label: "💋 Обычная девушка", value: "girls" },
    { label: "🌶 Девушка с перчиком", value: "pepper" },
];
const cancelKeyboard = telegraf_1.Markup.keyboard([[constants_1.CANCEL_BUTTON]]).resize();
const photoKeyboard = telegraf_1.Markup.keyboard([[constants_1.DONE_BUTTON], [constants_1.CANCEL_BUTTON]]).resize();
const categoryKeyboard = telegraf_1.Markup.keyboard([
    [CATEGORY_OPTIONS[0].label],
    [CATEGORY_OPTIONS[1].label],
    [constants_1.CANCEL_BUTTON],
]).resize();
const cityKeyboard = telegraf_1.Markup.keyboard([
    [constants_1.AVAILABLE_CITIES[0], constants_1.AVAILABLE_CITIES[1]],
    [constants_1.AVAILABLE_CITIES[2], constants_1.AVAILABLE_CITIES[3]],
    [constants_1.AVAILABLE_CITIES[4]],
    [constants_1.CANCEL_BUTTON],
]).resize();
function parseCategory(text) {
    return CATEGORY_OPTIONS.find((item) => item.label === text)?.value ?? null;
}
function parseCity(text) {
    return constants_1.AVAILABLE_CITIES.find((city) => city === text) ?? null;
}
async function leaveToWorkMenu(ctx, text) {
    ctx.session.cardDraft = undefined;
    await ctx.scene.leave();
    await ctx.reply(text, (0, teambot_1.teamWorkKeyboard)());
    await (0, views_1.showTeamWorkMenu)(ctx);
}
exports.teamCreateCardScene = new telegraf_1.Scenes.WizardScene("team-create-card", async (ctx) => {
    ctx.session.cardDraft = { photos: [] };
    await ctx.reply(`Отправьте 3-4 фотографии анкеты. После загрузки нажмите «${constants_1.DONE_BUTTON}».`, photoKeyboard);
    return ctx.wizard.next();
}, async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
        if (ctx.message.text === constants_1.CANCEL_BUTTON) {
            await leaveToWorkMenu(ctx, "Создание анкеты отменено.");
            return;
        }
        if (ctx.message.text === constants_1.DONE_BUTTON) {
            const count = ctx.session.cardDraft?.photos?.length ?? 0;
            if (count < 3 || count > 4) {
                await ctx.reply("Нужно загрузить от 3 до 4 фото.");
                return;
            }
            await ctx.reply("Выберите тип анкеты.", categoryKeyboard);
            return ctx.wizard.next();
        }
    }
    if (ctx.message && "photo" in ctx.message) {
        const draft = ctx.session.cardDraft;
        if (!draft) {
            await leaveToWorkMenu(ctx, "Сценарий сброшен.");
            return;
        }
        draft.photos = draft.photos ?? [];
        if (draft.photos.length >= 4) {
            await ctx.reply(`Уже загружено 4 фото. Нажмите «${constants_1.DONE_BUTTON}» или «${constants_1.CANCEL_BUTTON}».`);
            return;
        }
        const photo = ctx.message.photo.at(-1);
        if (photo) {
            draft.photos.push(photo.file_id);
        }
        await ctx.reply(draft.photos.length >= 3
            ? `Фото сохранено: ${draft.photos.length}/4. Можно отправить ещё одно фото или нажать «${constants_1.DONE_BUTTON}».`
            : `Фото сохранено: ${draft.photos.length}/4. Загрузите ещё фото.`, photoKeyboard);
        return;
    }
    await ctx.reply(`Отправьте фото или нажмите «${constants_1.DONE_BUTTON}».`);
}, async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
        if (ctx.message.text === constants_1.CANCEL_BUTTON) {
            await leaveToWorkMenu(ctx, "Создание анкеты отменено.");
            return;
        }
        const category = parseCategory(ctx.message.text);
        if (!category) {
            await ctx.reply("Выберите один из двух вариантов кнопкой ниже.", categoryKeyboard);
            return;
        }
        ctx.session.cardDraft = { ...ctx.session.cardDraft, category };
        await ctx.reply("Введите имя.", cancelKeyboard);
        return ctx.wizard.next();
    }
    await ctx.reply("Выберите тип анкеты кнопкой ниже.", categoryKeyboard);
}, async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
        if (ctx.message.text === constants_1.CANCEL_BUTTON) {
            await leaveToWorkMenu(ctx, "Создание анкеты отменено.");
            return;
        }
        ctx.session.cardDraft = { ...ctx.session.cardDraft, name: ctx.message.text.trim() };
        await ctx.reply("Введите возраст.", cancelKeyboard);
        return ctx.wizard.next();
    }
    await ctx.reply("Введите имя текстом.");
}, async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
        if (ctx.message.text === constants_1.CANCEL_BUTTON) {
            await leaveToWorkMenu(ctx, "Создание анкеты отменено.");
            return;
        }
        const age = (0, validators_1.parseAge)(ctx.message.text);
        if (!age) {
            await ctx.reply("Возраст должен быть числом от 18 до 99.");
            return;
        }
        ctx.session.cardDraft = { ...ctx.session.cardDraft, age };
        await ctx.reply("Введите стоимость за 1 час.", cancelKeyboard);
        return ctx.wizard.next();
    }
    await ctx.reply("Введите возраст числом.");
}, async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
        if (ctx.message.text === constants_1.CANCEL_BUTTON) {
            await leaveToWorkMenu(ctx, "Создание анкеты отменено.");
            return;
        }
        const price = (0, validators_1.parsePositiveNumber)(ctx.message.text);
        if (!price) {
            await ctx.reply("Введите корректную стоимость за 1 час.");
            return;
        }
        ctx.session.cardDraft = { ...ctx.session.cardDraft, price1h: price };
        await ctx.reply("Введите стоимость за 3 часа.", cancelKeyboard);
        return ctx.wizard.next();
    }
    await ctx.reply("Введите стоимость текстом.");
}, async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
        if (ctx.message.text === constants_1.CANCEL_BUTTON) {
            await leaveToWorkMenu(ctx, "Создание анкеты отменено.");
            return;
        }
        const price = (0, validators_1.parsePositiveNumber)(ctx.message.text);
        if (!price) {
            await ctx.reply("Введите корректную стоимость за 3 часа.");
            return;
        }
        ctx.session.cardDraft = { ...ctx.session.cardDraft, price3h: price };
        await ctx.reply("Введите стоимость за весь день.", cancelKeyboard);
        return ctx.wizard.next();
    }
    await ctx.reply("Введите стоимость текстом.");
}, async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
        if (ctx.message.text === constants_1.CANCEL_BUTTON) {
            await leaveToWorkMenu(ctx, "Создание анкеты отменено.");
            return;
        }
        const price = (0, validators_1.parsePositiveNumber)(ctx.message.text);
        if (!price) {
            await ctx.reply("Введите корректную стоимость за весь день.");
            return;
        }
        ctx.session.cardDraft = { ...ctx.session.cardDraft, priceFullDay: price };
        await ctx.reply("Выберите город кнопкой ниже.", cityKeyboard);
        return ctx.wizard.next();
    }
    await ctx.reply("Введите стоимость текстом.");
}, async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
        if (ctx.message.text === constants_1.CANCEL_BUTTON) {
            await leaveToWorkMenu(ctx, "Создание анкеты отменено.");
            return;
        }
        const city = parseCity(ctx.message.text);
        if (!city) {
            await ctx.reply("Выберите город кнопкой ниже.", cityKeyboard);
            return;
        }
        const user = ctx.state.user;
        if (!user) {
            await leaveToWorkMenu(ctx, "Пользователь не найден. Выполните /start заново.");
            return;
        }
        ctx.session.cardDraft = { ...ctx.session.cardDraft, city };
        ctx.session.cardDraft.photos = await (0, media_service_1.persistTelegramPhotoReferences)(ctx.telegram, ctx.session.cardDraft.photos ?? [], `cards/${user.id}`);
        const card = await (0, cards_service_1.createCard)(user.id, ctx.session.cardDraft, {
            reviewStatus: "pending",
            isActive: false,
            source: "user",
        });
        if (card) {
            await (0, card_review_service_1.notifyAdminsAboutCardReview)(card.id);
        }
        await leaveToWorkMenu(ctx, "Анкета отправлена администраторам на проверку. После одобрения она появится в Honey Bunny.");
        return;
    }
    await ctx.reply("Выберите город кнопкой ниже.", cityKeyboard);
});
