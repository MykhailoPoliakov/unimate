let socialDraft = null;
let linkDraft = null;

export function setSocialDraft(item) {
  socialDraft = item ?? null;
}

export function getSocialDraft() {
  return socialDraft;
}

export function setLinkDraft(item) {
  linkDraft = item ?? null;
}

export function getLinkDraft() {
  return linkDraft;
}
