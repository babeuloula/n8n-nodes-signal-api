// Unit tests run with node:test and are not shipped in the package
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { allowedVersions, releaseChangelog } from '../.github/scripts/prepare-release.mjs';

describe('allowedVersions', () => {
	it('accepts the same version and the next patch, minor and major', () => {
		assert.deepEqual(allowedVersions('0.3.1'), ['0.3.1', '0.3.2', '0.4.0', '1.0.0']);
	});

	it('rejects typos such as 3.0.0 after 0.3.0', () => {
		assert.equal(allowedVersions('0.3.0').includes('3.0.0'), false);
	});
});

describe('releaseChangelog', () => {
	const changelog = ['# Changelog', '', '## Unreleased', '', '### Fixed', '- Something', '', '## 0.3.1', '', '- Old', ''].join('\n');

	it('releases the Unreleased section and adds a new empty one', () => {
		assert.equal(
			releaseChangelog(changelog, '0.3.2', ['ignored']),
			['# Changelog', '', '## Unreleased', '', '## 0.3.2', '', '### Fixed', '- Something', '', '## 0.3.1', '', '- Old', ''].join('\n'),
		);
	});

	it('lists the commits when the Unreleased section is empty', () => {
		const empty = ['# Changelog', '', '## Unreleased', '', '## 0.3.1', '', '- Old', ''].join('\n');
		assert.equal(
			releaseChangelog(empty, '0.3.2', ['fix: a', 'feat: b']),
			['# Changelog', '', '## Unreleased', '', '## 0.3.2', '', '- fix: a', '- feat: b', '', '## 0.3.1', '', '- Old', ''].join('\n'),
		);
	});

	it('adds the sections when there is no Unreleased section', () => {
		const none = ['# Changelog', '', '## 0.3.1', '', '- Old', ''].join('\n');
		assert.equal(
			releaseChangelog(none, '0.3.2', ['fix: a']),
			['# Changelog', '', '## Unreleased', '', '## 0.3.2', '', '- fix: a', '', '## 0.3.1', '', '- Old', ''].join('\n'),
		);
	});

	it('is idempotent when the version is already released (retry)', () => {
		const released = releaseChangelog(changelog, '0.3.2', []);
		assert.equal(releaseChangelog(released, '0.3.2', ['x']), released);
	});
});
