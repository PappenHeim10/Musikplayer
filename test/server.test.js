// Unit-Tests für src/server.js – nutzt den eingebauten node:test-Runner.
// Ausführen mit:  npm test   (bzw. node --test)

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const {
    createMusicServer,
    getMusicFiles,
    isSupportedAudioFile,
    getContentType,
    resolveWithinRoot,
    parseRange,
    isAllowedOrigin,
    SUPPORTED_EXTENSIONS,
} = require('../src/server');

// --- isSupportedAudioFile -----------------------------------------------------
test('isSupportedAudioFile: erlaubt unterstützte Formate (auch GROSSSCHREIBUNG)', () => {
    assert.strictEqual(isSupportedAudioFile('song.mp3'), true);
    assert.strictEqual(isSupportedAudioFile('song.FLAC'), true);
    assert.strictEqual(isSupportedAudioFile('a.b.c.wav'), true);
});

test('isSupportedAudioFile: lehnt Nicht-Audio und endungslose Dateien ab', () => {
    assert.strictEqual(isSupportedAudioFile('readme.txt'), false);
    assert.strictEqual(isSupportedAudioFile('cover.jpg'), false);
    assert.strictEqual(isSupportedAudioFile('ohne-endung'), false);
});

// --- getContentType -----------------------------------------------------------
test('getContentType: leitet MIME-Type aus der Endung ab', () => {
    assert.strictEqual(getContentType('a.mp3'), 'audio/mpeg');
    assert.strictEqual(getContentType('a.wav'), 'audio/wav');
    assert.strictEqual(getContentType('a.flac'), 'audio/flac');
    assert.strictEqual(getContentType('a.opus'), 'audio/ogg');
    assert.strictEqual(getContentType('a.m4a'), 'audio/mp4');
    assert.strictEqual(getContentType('a.MP3'), 'audio/mpeg'); // case-insensitive
});

test('getContentType: Fallback für unbekannte Endung', () => {
    assert.strictEqual(getContentType('a.xyz'), 'application/octet-stream');
    assert.strictEqual(getContentType('keine-endung'), 'application/octet-stream');
});

test('SUPPORTED_EXTENSIONS und CONTENT_TYPES bleiben konsistent', () => {
    assert.ok(SUPPORTED_EXTENSIONS.includes('.mp3'));
    for (const ext of SUPPORTED_EXTENSIONS) {
        assert.notStrictEqual(getContentType(`x${ext}`), 'application/octet-stream');
    }
});

// --- resolveWithinRoot (Path-Traversal-Schutz) --------------------------------
test('resolveWithinRoot: erlaubt Dateien im Ordner und Unterordnern', () => {
    const root = path.resolve('music-root');
    assert.strictEqual(resolveWithinRoot(root, 'song.mp3'), path.join(root, 'song.mp3'));
    assert.strictEqual(resolveWithinRoot(root, 'sub/song.mp3'), path.join(root, 'sub', 'song.mp3'));
});

test('resolveWithinRoot: blockt ../-Traversal', () => {
    const root = path.resolve('music-root');
    assert.strictEqual(resolveWithinRoot(root, '../secret.mp3'), null);
    assert.strictEqual(resolveWithinRoot(root, '../../etc/passwd'), null);
});

test('resolveWithinRoot: blockt Geschwisterordner mit gleichem Präfix', () => {
    const root = path.resolve('music');
    // ".../music-privat/..." darf NICHT als innerhalb von ".../music" gelten
    assert.strictEqual(resolveWithinRoot(root, '../music-privat/song.mp3'), null);
});

test('resolveWithinRoot: blockt absolute Pfade / anderes Laufwerk', { skip: process.platform !== 'win32' }, () => {
    const root = path.resolve('C:\\Users\\me\\Musik');
    assert.strictEqual(resolveWithinRoot(root, 'C:\\Windows\\win.ini'), null);
    assert.strictEqual(resolveWithinRoot(root, 'D:\\other\\x.mp3'), null);
});

// --- parseRange ---------------------------------------------------------------
test('parseRange: vollständiger Bereich', () => {
    assert.deepStrictEqual(parseRange('bytes=0-99', 1000), { start: 0, end: 99 });
});

test('parseRange: offenes Ende nutzt Dateigröße', () => {
    assert.deepStrictEqual(parseRange('bytes=500-', 1000), { start: 500, end: 999 });
});

test('parseRange: ungültige Bereiche ergeben null', () => {
    assert.strictEqual(parseRange('bytes=1000-1100', 1000), null); // start >= size
    assert.strictEqual(parseRange('bytes=0-1000', 1000), null);    // end >= size
    assert.strictEqual(parseRange('bytes=50-10', 1000), null);     // end < start
    assert.strictEqual(parseRange('bytes=-500', 1000), null);      // Suffix-Range (nicht unterstützt)
});

// --- isAllowedOrigin ----------------------------------------------------------
test('isAllowedOrigin: nur App-Origin (null / file://)', () => {
    assert.strictEqual(isAllowedOrigin('null'), true);
    assert.strictEqual(isAllowedOrigin('file:///C:/app/index.html'), true);
    assert.strictEqual(isAllowedOrigin('https://evil.com'), false);
    assert.strictEqual(isAllowedOrigin(undefined), false);
});

// --- getMusicFiles (gegen echtes Dateisystem in Temp-Ordner) ------------------
test('getMusicFiles: liefert nur unterstützte Audiodateien', async (t) => {
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'mp-test-'));
    t.after(() => fs.promises.rm(dir, { recursive: true, force: true }));

    for (const name of ['a.mp3', 'b.wav', 'c.flac', 'notes.txt', 'cover.jpg']) {
        await fs.promises.writeFile(path.join(dir, name), 'x');
    }

    const files = (await getMusicFiles(dir)).sort();
    assert.deepStrictEqual(files, ['a.mp3', 'b.wav', 'c.flac']);
});

test('getMusicFiles: leeres Array bei nicht existierendem Ordner', async () => {
    const files = await getMusicFiles(path.join(os.tmpdir(), 'gibt-es-nicht-xyz-123'));
    assert.deepStrictEqual(files, []);
});

// --- Integration: HTTP-Endpunkte ---------------------------------------------
test('Server: /api/songs und /api/audio inkl. Traversal-Schutz', async (t) => {
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'mp-srv-'));
    t.after(() => fs.promises.rm(dir, { recursive: true, force: true }));
    await fs.promises.writeFile(path.join(dir, 'tune.wav'), 'AUDIODATA0123456789');
    await fs.promises.writeFile(path.join(path.dirname(dir), 'secret.txt'), 'geheim');

    const server = createMusicServer(() => dir);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}`;

    const songs = await (await fetch(`${base}/api/songs`)).json();
    assert.deepStrictEqual(songs, ['tune.wav']);

    const audio = await fetch(`${base}/api/audio/${encodeURIComponent('tune.wav')}`);
    assert.strictEqual(audio.status, 200);
    assert.strictEqual(audio.headers.get('content-type'), 'audio/wav');

    const ranged = await fetch(`${base}/api/audio/${encodeURIComponent('tune.wav')}`, { headers: { Range: 'bytes=0-4' } });
    assert.strictEqual(ranged.status, 206);
    assert.strictEqual(await ranged.text(), 'AUDIO');

    const traversal = await fetch(`${base}/api/audio/${encodeURIComponent('../secret.txt')}`);
    assert.strictEqual(traversal.status, 403);

    const missing = await fetch(`${base}/api/audio/${encodeURIComponent('nope.mp3')}`);
    assert.strictEqual(missing.status, 404);
});
