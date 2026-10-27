// Prepares a release from the pushed tag (see .github/workflows/publish.yml):
// - checks that the tag is the next patch, minor or major version of the latest
//   published version (or the same version, to retry a failed publication);
// - turns the "## Unreleased" section of CHANGELOG.md into "## <version>" (or,
//   if it is empty, lists the commits since the previous tag).
// package.json and package-lock.json are then updated with `npm version`.
//
// Usage: node .github/scripts/prepare-release.mjs <version> [--check-only]

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const UNRELEASED = '## Unreleased';

export function parseVersion(version) {
	const match = SEMVER.exec(version);
	return match ? match.slice(1).map(Number) : null;
}

export function compareVersions(a, b) {
	const [x, y] = [parseVersion(a), parseVersion(b)];
	for (let i = 0; i < 3; i++) {
		if (x[i] !== y[i]) return x[i] - y[i];
	}
	return 0;
}

// Versions accepted after `current`: itself (retry) and the next patch, minor, major
export function allowedVersions(current) {
	const [major, minor, patch] = parseVersion(current);
	return [
		current,
		`${major}.${minor}.${patch + 1}`,
		`${major}.${minor + 1}.0`,
		`${major + 1}.0.0`,
	];
}

// Returns the changelog with the "Unreleased" section released as `version`, and
// a new empty "Unreleased" section above it. `fallbackEntries` is used when the
// "Unreleased" section is missing or empty.
export function releaseChangelog(changelog, version, fallbackEntries) {
	const heading = `## ${version}`;
	if (changelog.split('\n').some((line) => line.trim() === heading)) {
		return changelog; // Already released (retry)
	}

	const lines = changelog.split('\n');
	const start = lines.findIndex((line) => line.trim() === UNRELEASED);
	let end = lines.length;
	if (start !== -1) {
		const next = lines.findIndex((line, i) => i > start && line.startsWith('## '));
		end = next === -1 ? lines.length : next;
	}
	const content = start === -1 ? '' : lines.slice(start + 1, end).join('\n').trim();
	const body = content || fallbackEntries.map((entry) => `- ${entry}`).join('\n') || '- No notable changes.';
	const released = [UNRELEASED, '', heading, '', body, ''];

	if (start !== -1) {
		lines.splice(start, end - start, ...released);
		return lines.join('\n');
	}

	// No "Unreleased" section: insert after the title
	const title = lines.findIndex((line) => line.startsWith('# '));
	lines.splice(title + 1, 0, '', ...released.slice(0, -1));
	return lines.join('\n');
}

function git(...args) {
	return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function publishedVersion(name) {
	try {
		return execFileSync('npm', ['view', name, 'version'], { encoding: 'utf8' }).trim() || null;
	} catch {
		return null; // Not published yet
	}
}

function commitsSincePreviousTag(version) {
	const tags = git('tag', '--list', '--merged', 'HEAD')
		.split('\n')
		.filter((tag) => parseVersion(tag) && compareVersions(tag, version) < 0)
		.sort(compareVersions);
	const range = tags.length ? `${tags[tags.length - 1]}..HEAD` : 'HEAD';
	return git('log', '--no-merges', '--format=%s', range)
		.split('\n')
		.filter((subject) => subject && !subject.startsWith('chore(release)'));
}

function main() {
	const [version, flag] = process.argv.slice(2);
	if (!parseVersion(version ?? '')) {
		throw new Error(`Invalid version "${version}": expected a tag like 1.2.3 (no "v" prefix)`);
	}

	const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
	const published = publishedVersion(pkg.name);
	const base =
		published && compareVersions(published, pkg.version) > 0 ? published : pkg.version;
	const allowed = allowedVersions(base);
	if (!allowed.includes(version)) {
		throw new Error(
			`Tag ${version} is not a valid next version of ${base}: expected one of ${allowed.join(', ')}`,
		);
	}
	if (flag === '--check-only') return;

	const changelog = readFileSync('CHANGELOG.md', 'utf8');
	writeFileSync('CHANGELOG.md', releaseChangelog(changelog, version, commitsSincePreviousTag(version)));
	console.log(`Prepared release ${version} (previous: ${base})`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		main();
	} catch (error) {
		console.error(`::error::${error.message}`);
		process.exitCode = 1;
	}
}
