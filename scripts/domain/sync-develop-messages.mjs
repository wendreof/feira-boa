const DEVELOP_BRANCH = "develop";
const MAIN_REF = "origin/main";

export function formatMergeConflictMessage(unmergedFiles) {
  const list = unmergedFiles.length > 0 ? unmergedFiles.join(", ") : "(unknown files)";
  return `Merge of ${MAIN_REF} into ${DEVELOP_BRANCH} aborted due to conflicts: ${list}. Resolve on another branch or merge manually.`;
}