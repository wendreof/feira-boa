import { appState, type CardRefs } from "./state";
import { element, shareIcon, favoriteButton, reactionButton } from "./elements";
import { money, dateLabel, expiryHighlightLabel } from "../view/format";
import { offerCategory, offerOrder } from "./offer-model";
import { createOfferStoreLogo, updateOfferStoreLogo } from "./store-logo";
import { type Offer } from "../types";
import { displayOfferIcon, formatOfferSpec } from "../../scripts/domain/display-offer.mjs";
import { offerCardCategoryLine } from "../../scripts/domain/card-category-line.mjs";

export function createOfferCard(offer: Offer, options?: { archived?: boolean }): CardRefs {
  const root = element("article", "offer-card");
  if (options?.archived) root.classList.add("is-archived");
  root.dataset.offerId = offer.id;
  root.dataset.categoryRank = String(offerOrder(offer));

  const visual = element("div", "visual");
  const sticker = element("span", "offer-sticker", "OFERTA");
  const art = element("span", "product-art");
  art.setAttribute("role", "img");
  art.setAttribute("aria-label", `Ilustração de ${offer.name}`);
  const favoriteArt = favoriteButton(offer, "favorite-toggle favorite-toggle-art");
  visual.append(sticker, art, favoriteArt);

  const body = element("div", "card-body");
  const notice = element("p", "offer-notice");
  const titleRow = element("div", "card-title");
  const name = element("h3");
  titleRow.append(name);
  const meta = element("div", "card-meta");
  const spec = element("span", "spec");
  meta.append(spec);
  const info = element("div", "card-info");
  const priceRow = element("div", "price-row");
  const priceBlock = element("div", "price-block");
  const price = element("span", "price");
  const oldPrice = element("span", "old-price");
  const discount = element("span", "discount-badge");
  priceBlock.append(price, discount, oldPrice);
  const valid = element("span", "valid-until", "Válido");
  const validStrong = element("strong");
  valid.append(validStrong);
  priceRow.append(priceBlock, valid);

  const reactionGroup = element("div", "offer-reactions");
  reactionGroup.setAttribute("role", "group");
  reactionGroup.setAttribute("aria-label", "Esta oferta vale a pena?");
  const favoriteReaction = favoriteButton(offer, "favorite-toggle favorite-toggle-reaction");
  const like = reactionButton(offer);
  reactionGroup.append(favoriteReaction, like.button);

  const note = element("p", "offer-note");
  const expiryFlag = element("span", "offer-expiry-flag");
  expiryFlag.hidden = true;
  const source = element("div", "card-source");
  const { root: storeLogo, fallback: storeLogoFallback, img: storeLogoImg } = createOfferStoreLogo();
  const sourceLink = element("a");
  sourceLink.target = "_blank";
  sourceLink.rel = "noopener";
  sourceLink.textContent = "ver oferta";
  const share = element("button", "share-offer");
  share.type = "button";
  share.dataset.shareId = offer.id;
  share.append(shareIcon());
  source.append(storeLogo, document.createTextNode(" · "), sourceLink, expiryFlag, share);

  body.append(notice, titleRow, meta, info, priceRow, reactionGroup, note, source);
  root.classList.add("offer-card--opens-source");
  root.append(visual, body);

  const refs: CardRefs = {
    root, art, name, spec, info, price, oldPrice, discount, sticker, valid: validStrong, expiryFlag, notice, note,
    storeLogo, storeLogoFallback, storeLogoImg,
    sourceLink, share, favoriteButtons: [favoriteArt, favoriteReaction],
    like: like.button, likeCount: like.count, reactionGroup, validWrap: valid,
  };
  updateOfferCard(refs, offer);
  return refs;
}

export function updateOfferCard(refs: CardRefs, offer: Offer): void {
  const icon = displayOfferIcon(offer);
  refs.art.textContent = icon;
  refs.art.setAttribute("aria-label", `Ilustração de ${offer.name}`);
  refs.name.textContent = offer.name;
  const category = offerCategory(offer);
  refs.info.textContent = offerCardCategoryLine(offer, category, {
    activeDepartment: appState.activeDepartment,
  });
  const specText = formatOfferSpec(offer.detail);
  refs.spec.textContent = specText;
  refs.spec.hidden = !specText;
  refs.price.textContent = money(offer.price);
  const discountPercent = offer.previousPrice && offer.previousPrice > offer.price
    ? Math.round((1 - offer.price / offer.previousPrice) * 100)
    : 0;
  refs.oldPrice.textContent = offer.previousPrice ? money(offer.previousPrice) : "";
  refs.oldPrice.hidden = true;
  refs.discount.textContent = discountPercent > 0 ? `-${discountPercent}%` : "";
  refs.discount.hidden = discountPercent <= 0;
  if (discountPercent > 0) {
    refs.discount.title = `De ${money(offer.previousPrice!)} por ${money(offer.price)}`;
    refs.discount.setAttribute("aria-label", `Desconto de ${discountPercent} por cento, de ${money(offer.previousPrice!)} por ${money(offer.price)}`);
  } else {
    refs.discount.removeAttribute("title");
    refs.discount.removeAttribute("aria-label");
  }
  refs.valid.textContent = `${dateLabel(offer.validFrom)}–${dateLabel(offer.validTo)}`;
  const archived = refs.root.classList.contains("is-archived");
  const expiryLabel = archived ? null : expiryHighlightLabel(offer);
  refs.expiryFlag.textContent = expiryLabel ?? "";
  refs.expiryFlag.hidden = !expiryLabel;
  refs.validWrap.hidden = Boolean(expiryLabel);
  refs.validWrap.classList.toggle("has-expiry-soon", Boolean(expiryLabel));
  refs.root.classList.toggle("is-expiring-soon", Boolean(expiryLabel));
  refs.root.classList.toggle("is-expiring-today", expiryLabel === "Último dia");
  if (archived) {
    refs.sticker.textContent = "Encerrado";
    refs.sticker.classList.remove("offer-sticker-expiry", "offer-sticker-expiry-today");
    refs.sticker.classList.add("offer-sticker-archived");
  } else if (expiryLabel) {
    refs.sticker.textContent = expiryLabel;
    refs.sticker.classList.remove("offer-sticker-archived");
    refs.sticker.classList.add("offer-sticker-expiry");
    refs.sticker.classList.toggle("offer-sticker-expiry-today", expiryLabel === "Último dia");
  } else {
    refs.sticker.textContent = "OFERTA";
    refs.sticker.classList.remove("offer-sticker-expiry", "offer-sticker-expiry-today", "offer-sticker-archived");
  }
  refs.notice.textContent = offer.notice ?? "";
  refs.notice.hidden = !offer.notice;
  refs.note.textContent = offer.note;
  refs.note.hidden = !offer.note;
  updateOfferStoreLogo(
    { root: refs.storeLogo, fallback: refs.storeLogoFallback, img: refs.storeLogoImg },
    offer,
  );
  refs.sourceLink.href = /^https:\/\//.test(offer.sourceUrl) ? offer.sourceUrl : "#";
  refs.sourceLink.title = offer.branch ? `${offer.store} · ${offer.branch}` : offer.store;
  refs.share.setAttribute("aria-label", `Compartilhar ${offer.name}`);
  refs.share.title = `Compartilhar ${offer.name}`;

  const favoriteLabel = appState.favoriteIds.has(offer.id) ? "Remover dos favoritos" : "Adicionar aos favoritos";
  for (const button of refs.favoriteButtons) {
    button.setAttribute("aria-pressed", String(appState.favoriteIds.has(offer.id)));
    button.setAttribute("aria-label", favoriteLabel);
  }

  const counts = appState.reactionCounts.get(offer.id) ?? { likes: 0, dislikes: 0 };
  const currentReaction = appState.userReactions.get(offer.id);
  refs.like.classList.toggle("selected", currentReaction === "like");
  refs.like.setAttribute("aria-pressed", String(currentReaction === "like"));
  refs.like.setAttribute("aria-label", `Gostei desta oferta, ${counts.likes} votos`);
  refs.like.title = appState.currentUserId ? "Gostei" : "Entre para avaliar e salvar seu voto";
  if (appState.currentUserId) refs.like.removeAttribute("aria-haspopup");
  else refs.like.setAttribute("aria-haspopup", "dialog");
  refs.likeCount.textContent = String(counts.likes);
  if (archived) {
    for (const button of refs.favoriteButtons) button.disabled = true;
    refs.like.disabled = true;
    refs.like.setAttribute("aria-disabled", "true");
  } else {
    for (const button of refs.favoriteButtons) button.disabled = false;
    refs.like.disabled = false;
    refs.like.removeAttribute("aria-disabled");
  }
}
