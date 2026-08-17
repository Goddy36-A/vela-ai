import { ENV } from "./_core/env";

const GITHUB_API_BASE = "https://api.github.com";

function getHeaders() {
  const token = process.env.GITHUB_PAT;
  return {
    "Accept": "application/vnd.github+json",
    "Authorization": token ? `Bearer ${token}` : "",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Open-Agent-Assistant-Copilot"
  };
}

export async function githubListRepos(username: string) {
  const res = await fetch(`${GITHUB_API_BASE}/users/${username}/repos?sort=updated&per_page=15`, {
    headers: getHeaders()
  });
  if (!res.ok) {
    throw new Error(`Failed to list GitHub repos: ${res.status} ${res.statusText}`);
  }
  const repos = (await res.json()) as Array<any>;
  return repos.map(r => ({
    name: r.name,
    fullName: r.full_name,
    description: r.description,
    htmlUrl: r.html_url,
    language: r.language,
    updatedAt: r.updated_at
  }));
}

export async function githubGetFileContent(owner: string, repo: string, path: string, ref = "main") {
  const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${ref}`, {
    headers: getHeaders()
  });
  if (!res.ok) {
    throw new Error(`Failed to get file ${path}: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as any;
  if (data.type === "file" && data.content) {
    const buffer = Buffer.from(data.content, data.encoding || "base64");
    return buffer.toString("utf8");
  }
  throw new Error(`Path ${path} is not a valid file`);
}

export async function githubCreateOrUpdateFile(owner: string, repo: string, path: string, content: string, message: string, branch = "main") {
  let sha: string | undefined;
  try {
    const checkRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, {
      headers: getHeaders()
    });
    if (checkRes.ok) {
      const existing = (await checkRes.json()) as any;
      sha = existing.sha;
    }
  } catch {
    // File may not exist yet.
  }

  const encodedContent = Buffer.from(content, "utf8").toString("base64");
  const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    headers: {
      ...getHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message,
      content: encodedContent,
      branch,
      ...(sha ? { sha } : {})
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to commit file ${path}: ${res.status} – ${errText}`);
  }

  const data = (await res.json()) as any;
  return {
    commitSha: data.commit?.sha,
    contentUrl: data.content?.html_url
  };
}

export async function githubCreatePullRequest(owner: string, repo: string, title: string, body: string, head: string, base = "main") {
  const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    headers: {
      ...getHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title,
      body,
      head,
      base
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create pull request: ${res.status} – ${errText}`);
  }

  const data = (await res.json()) as any;
  return {
    prNumber: data.number,
    htmlUrl: data.html_url
  };
}
