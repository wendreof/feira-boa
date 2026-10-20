const title = process.argv[2];
if (!title) {
  console.error("Usage: node scripts/github-issue.mjs <issue-title>");
  process.exit(1);
}

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
if (!token || !repository) {
  console.error("GITHUB_TOKEN and GITHUB_REPOSITORY are required.");
  process.exit(1);
}

const apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";
const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
const runId = process.env.GITHUB_RUN_ID;
const workflow = process.env.GITHUB_WORKFLOW ?? "GitHub Actions";
const commit = process.env.GITHUB_SHA ?? "unknown";
const runUrl = runId ? `${serverUrl}/${repository}/actions/runs/${runId}` : `${serverUrl}/${repository}/actions`;
const body = [
  "An automated Feira Boa check failed.",
  "",
  `- Workflow: **${workflow}**`,
  `- Run: ${runUrl}`,
  `- Commit: \`${commit.slice(0, 7)}\``,
  `- Time: ${new Date().toISOString()}`,
  "",
  "Review the run log, fix the cause, and close this issue. Repeated failures add a comment instead of creating duplicates.",
].join("\n");

async function request(path, init = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "feira-boa-operations",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  return response.json();
}

const issues = await request(`/repos/${repository}/issues?state=open&per_page=100`);
const existing = issues.find((issue) => issue.title === title && !issue.pull_request);
if (existing) {
  await request(`/repos/${repository}/issues/${existing.number}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  console.log(`Updated issue #${existing.number}: ${title}`);
} else {
  const created = await request(`/repos/${repository}/issues`, {
    method: "POST",
    body: JSON.stringify({ title, body }),
  });
  console.log(`Created issue #${created.number}: ${title}`);
}
