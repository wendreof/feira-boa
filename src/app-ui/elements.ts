import { type Offer } from "../types";

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function heartIcon(): SVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z");
  svg.append(path);
  return svg;
}

export function shareIcon(): SVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const [cx, cy] of [["18", "5"], ["6", "12"], ["18", "19"]]) {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", cx);
    circle.setAttribute("cy", cy);
    circle.setAttribute("r", "2.8");
    circle.setAttribute("fill", "currentColor");
    svg.append(circle);
  }
  for (const [x1, y1, x2, y2] of [["8.1", "10.8", "15.6", "6.4"], ["8.1", "13.2", "15.6", "17.6"]]) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("stroke", "currentColor");
    line.setAttribute("stroke-width", "1.8");
    line.setAttribute("stroke-linecap", "round");
    svg.append(line);
  }
  return svg;
}

export function favoriteButton(offer: Offer, className: string): HTMLButtonElement {
  const button = element("button", className);
  button.type = "button";
  button.dataset.favoriteId = offer.id;
  button.append(heartIcon());
  return button;
}

export function reactionButton(offer: Offer): { button: HTMLButtonElement; count: HTMLElement } {
  const button = element("button", "offer-reaction-button");
  button.type = "button";
  button.dataset.reaction = "like";
  button.dataset.offerId = offer.id;
  const icon = element("span", "", "👍");
  icon.setAttribute("aria-hidden", "true");
  const count = element("span", "", "0");
  button.append(icon, count);
  return { button, count };
}
