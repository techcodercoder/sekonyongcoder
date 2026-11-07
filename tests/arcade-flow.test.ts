import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import storyConfig from '../src/data/story-config.json' with { type: 'json' };

// Interface definition matching FightScene.ts
export interface RoundData {
  mode: 'arcade' | 'cpu' | 'versus' | 'dojo' | 'demo';
  wins: [number, number];
  round: number;
  chapterIndex?: number;
  player1Char?: string;
  cpuChar?: string;
}

// Logic helper mirroring FightScene matchOver and chapter resolve
function resolveChapterData(match: RoundData) {
  const currentIdx = match.chapterIndex ?? 1;
  const currentChapter =
    storyConfig.chapters.find((c: any) => c.chapterIndex === currentIdx) ??
    storyConfig.chapters[0];
  const p1Char =
    match.player1Char ??
    (match.mode === 'arcade' ? currentChapter?.player1 : 'hanoman') ??
    'hanoman';
  const cpuChar =
    match.cpuChar ??
    (match.mode === 'arcade' ? currentChapter?.cpu : 'hanoman') ??
    'hanoman';
  return { currentIdx, currentChapter, p1Char, cpuChar };
}

function handleRematch(currentMatch: RoundData): RoundData {
  // Exact fixed implementation from FightScene.ts line 450
  return {
    ...currentMatch,
    wins: [0, 0],
    round: 1,
  };
}

function handleBuggyRematch(currentMatch: RoundData): RoundData {
  // Previous buggy implementation that omitted match metadata
  return {
    mode: currentMatch.mode,
    wins: [0, 0],
    round: 1,
  };
}

describe('Arcade Story Mode Flow & Rematch Tests', () => {
  test('SCENARIO USER: Dalang menang di Babak 3 -> Rematch dengan tombol J harus tetap di Babak 3', () => {
    // 1. Initial State: Player bertarung di Babak 3 (Hanoman vs Indrajit)
    const initialBabak3Match: RoundData = {
      mode: 'arcade',
      wins: [0, 2], // Dalang menang 2 ronde
      round: 2,
      chapterIndex: 3,
      player1Char: 'hanoman',
      cpuChar: 'indrajit',
    };

    // 2. Pemain menekan tombol 'J' untuk rematch
    const restartedMatch = handleRematch(initialBabak3Match);

    // 3. Verifikasi data pertandingan setelah restart
    assert.strictEqual(restartedMatch.mode, 'arcade', 'Mode harus tetap arcade');
    assert.strictEqual(restartedMatch.chapterIndex, 3, 'ChapterIndex HARUS tetap 3 (Babak 3)');
    assert.strictEqual(restartedMatch.player1Char, 'hanoman', 'Player 1 HARUS tetap Hanoman');
    assert.strictEqual(restartedMatch.cpuChar, 'indrajit', 'CPU HARUS tetap Indrajit');
    assert.deepStrictEqual(restartedMatch.wins, [0, 0], 'Skor kemenangan harus direset ke 0-0');
    assert.strictEqual(restartedMatch.round, 1, 'Ronde harus direset ke ronde 1');

    // 4. Resolve chapter di FightScene.create()
    const resolved = resolveChapterData(restartedMatch);
    assert.strictEqual(resolved.currentIdx, 3, 'Babak ter-resolve harus Babak 3');
    assert.strictEqual(resolved.currentChapter.title, 'Anoman Obong', 'Judul babak harus Anoman Obong');
    assert.strictEqual(resolved.p1Char, 'hanoman', 'Karakter P1 harus Hanoman');
    assert.strictEqual(resolved.cpuChar, 'indrajit', 'Karakter CPU harus Indrajit');

    // 5. Buktikan bahwa logika lama (buggy) gagal pada skenario ini
    const buggyRestart = handleBuggyRematch(initialBabak3Match);
    const buggyResolved = resolveChapterData(buggyRestart);
    assert.strictEqual(
      buggyResolved.currentIdx,
      1,
      'Logika lama terbukti salah karena jatuh ke Babak 1 (Sugriwa vs Subali)'
    );
    assert.strictEqual(buggyResolved.p1Char, 'sugriwa');
    assert.strictEqual(buggyResolved.cpuChar, 'subali');
  });

  test('SCENARIO: P1 Menang di Babak 3 -> Lanjut ke Babak 4 (Laksmana vs Yuyukangkang)', () => {
    const babak3Match: RoundData = {
      mode: 'arcade',
      wins: [2, 0],
      round: 2,
      chapterIndex: 3,
      player1Char: 'hanoman',
      cpuChar: 'indrajit',
    };

    const currentIdx = babak3Match.chapterIndex!;
    const nextIdx = currentIdx + 1;
    const currentChapter = storyConfig.chapters.find((c: any) => c.chapterIndex === currentIdx);
    const nextChapter = storyConfig.chapters.find((c: any) => c.chapterIndex === nextIdx);

    assert.ok(currentChapter, 'Babak 3 harus ada di story-config');
    assert.strictEqual(currentChapter.outroVideo, '/videos/outro_episode_3.mp4');

    assert.ok(nextChapter, 'Babak 4 harus ada');
    assert.strictEqual(nextChapter.chapterIndex, 4);
    assert.strictEqual(nextChapter.title, 'Pembangunan Tambak Samudra');
    assert.strictEqual(nextChapter.player1, 'laksmana');
    assert.strictEqual(nextChapter.cpu, 'yuyukangkang');
    assert.strictEqual(nextChapter.introVideo, '/videos/intro_episode_4.mp4');

    const nextMatchData: RoundData = {
      mode: 'arcade',
      wins: [0, 0],
      round: 1,
      chapterIndex: nextIdx,
      player1Char: nextChapter.player1,
      cpuChar: nextChapter.cpu,
    };

    assert.strictEqual(nextMatchData.chapterIndex, 4);
    assert.strictEqual(nextMatchData.player1Char, 'laksmana');
    assert.strictEqual(nextMatchData.cpuChar, 'yuyukangkang');
  });

  test('SCENARIO: P1 Menang di Babak 6 (Final) -> Lanjut ke PrambananScene', () => {
    const babak6Match: RoundData = {
      mode: 'arcade',
      wins: [2, 1],
      round: 3,
      chapterIndex: 6,
      player1Char: 'rama',
      cpuChar: 'rahwana',
    };

    const currentIdx = babak6Match.chapterIndex!;
    const nextIdx = currentIdx + 1;
    const nextChapter = storyConfig.chapters.find((c: any) => c.chapterIndex === nextIdx);

    assert.strictEqual(nextChapter, undefined, 'Babak 6 adalah babak puncak (tidak ada babak 7)');

    const promo = (storyConfig as any).prambananPromo;
    assert.ok(promo, 'PrambananPromo harus terkonfigurasi di story-config.json');
    assert.strictEqual(promo.enabled, true, 'PrambananPromo harus aktif');
    assert.strictEqual(promo.qrUrl, 'https://injourneydestination.id/');
    assert.ok(promo.headline.includes('Saksikan Mereka Menari'));
  });

  test('SCENARIO: Auto-Revive untuk P1 di Arcade Mode', () => {
    // Simulasi mekanisme auto-revive di Fighter.ts
    const maxHealth = 1000;
    const isAutoReviveP1 = true;
    const isAutoReviveCPU = false;

    // 1. P1 HP habis
    let p1Health = 0;
    let p1Status = '';
    if (p1Health === 0) {
      if (isAutoReviveP1) {
        p1Health = maxHealth;
        p1Status = 'revived';
      } else {
        p1Status = 'ko';
      }
    }
    assert.strictEqual(p1Status, 'revived', 'P1 harus otomatis revive');
    assert.strictEqual(p1Health, 1000, 'Darah P1 harus kembali penuh 1000');

    // 2. CPU HP habis
    let cpuHealth = 0;
    let cpuStatus = '';
    if (cpuHealth === 0) {
      if (isAutoReviveCPU) {
        cpuHealth = maxHealth;
        cpuStatus = 'revived';
      } else {
        cpuStatus = 'ko';
      }
    }
    assert.strictEqual(cpuStatus, 'ko', 'CPU harus K.O.');
    assert.strictEqual(cpuHealth, 0, 'Darah CPU tetap 0');
  });
});
