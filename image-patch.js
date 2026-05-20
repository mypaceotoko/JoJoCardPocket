// Patches FALLBACK_DATA characters with image URLs and catchphrases
(function () {
  const BASE = 'https://jojos-bizarre-api.netlify.app/assets/';

  const CHAR_IMGS = {
    // Part 1
    c1:  'jonathan.webp',
    c2:  'dio.webp',
    c3:  'zeppeli.webp',
    c4:  'speedwagon.png',
    c5:  'erina.png',
    c7:  'bruford.webp',
    c8:  'tarkus.webp',
    // Part 2
    c11: 'joseph.webp',
    c12: 'caesar.png',
    c13: 'lisalisa.webp',
    c14: 'wamuu.webp',
    c15: 'esidisi.webp',
    c16: 'kars.webp',
    c17: 'santana.png',
    c18: 'stronheim.png',
    // Part 3
    c23: 'jotaro.png',
    c24: 'kakyoin.webp',
    c25: 'polnareff.png',
    c26: 'avdol.webp',
    c27: 'iggy.webp',
    c28: 'holhorse.png',
    c29: 'rubbersoul.png',
    c30: 'devo.webp',
    c31: 'nena.webp',
    c32: 'zz.webp',
    c33: 'enya.webp',
    c34: 'steelydan.png',
    c35: 'arabia.webp',
    c36: 'mannish.png',
    c37: 'cameo.webp',
    c38: 'midler.webp',
    c39: 'alessi.webp',
    c40: 'mariah.webp',
    c41: 'danieldarby.webp',
    c42: 'terencedarby.png',
    c43: 'vanillaice.png',
    c44: 'ndoul.png',
    c45: 'oingo.png',
    c46: 'boingo.png',
    c47: 'petshop.png',
    c48: 'anubis.png',
    // Part 4
    c49: 'josuke.png',
    c50: 'koichi.png',
    c51: 'okuyasu.webp',
    c52: 'rohan.png',
    c53: 'kira.png',
    c54: 'yukako.png',
    c55: 'toshikazu.jpg',
    c56: 'tamami.png',
    c57: 'tonio.png',
    c58: 'shigechi.png',
    c59: 'akira.webp',
    c60: 'yuya.png',
    c62: 'yoshihorokira.webp',
    c63: 'angelo.webp',
    c64: 'keicho.png',
    c65: 'aya.png',
    c66: 'ken.png',
    c67: 'miyamoto.png',
    c68: 'toyohiro.png',
    // Part 5
    c69: 'giorno.png',
    c70: 'bucciarati.png',
    c71: 'guido.png',
    c72: 'narancia.png',
    c73: 'fugo.png',
    c74: 'trish.png',
    c75: 'diavolo.png',
    c76: 'doppio.png',
    c77: 'abbacchio.png',
    c78: 'ghiaccio.png',
    c79: 'risotto.png',
    c80: 'prosciutto.webp',
    c81: 'peschi.png',
    c82: 'illuso.webp',
    c83: 'formaggio.png',
    c84: 'melone.png',
    c85: 'squalo.png',
    c87: 'ciocco.png',
    c88: 'secco.png',
    // Part 6
    c89: 'jolyne.webp',
    c90: 'ermes.webp',
    c91: 'foofighters.png',
    c92: 'narciso.png',
    c93: 'weather.png',
    c94: 'pucci.webp',
    c95: 'emporio.png',
    c96: 'viviano.webp',
    c97: 'kenzou.png',
    c98: 'DG.webp',
    c99: 'donatello.png',
    c100:'miucca.png',
    c101:'rikiel.webp',
    c102:'sportsmaxx.png',
    c153:'gwess.webp',
    // Part 3 additional
    c140:'geil.webp',
    c141:'grayfly.png',
    c142:'captain.png',
    c143:'forever.png',
    c144:'devo.webp',
    // Part 4 additional
    c146:'mikitaka.png',
    c147:'masazo.png',
    c148:'jotaro.png',
    // Part 5 additional
    c149:'carne.png',
    // Part 6 additional
    c152:'pucci.webp',
  };

  // Catchphrases — only characters with memorable/famous lines
  const CATCHPHRASES = {
    // Part 1
    c3:  '波紋の修行を授けよう',
    c4:  '漢泣きするぜ…！',
    c7:  '誉れある武人として散ろう',
    // Part 2
    c12: 'ブライカッター！',
    c14: '男の誇りをかけて！全力で来い！',
    c15: 'ウォォォン！（泣く）',
    c16: '究極生命体に進化した！',
    c18: 'ドイツ科学は世界一ィィィ！',
    // Part 3
    c25: '俺の矜持にかけて！',
    c28: '銃使いは常にNo.2じゃなきゃいけない',
    c33: 'ジョジョォォォ！この恨み！',
    c34: 'ガハハ！困ったな！',
    c41: '魂を賭けないか？',
    c42: '魂は…すでにもらった',
    c43: 'ディオ様のためならァ！',
    c44: '目は使わぬ…耳で感じる',
    // Part 4
    c50: 'バリバリバリ！',
    c54: '好きなのに…なんで！',
    c58: '友達からもらった！',
    c64: '強くなれよ…億泰',
    c65: '美しくなりたい？',
    // Part 5
    c71: '4が嫌いだ！絶対嫌だ！',
    c73: 'パープル・ヘイズ！',
    c75: '誰もオレの過去を知ることはできない！',
    c76: 'ドッピオここにいます…',
    c77: '死んだ仲間は裏切れない',
    c78: 'ホワイト・アルバム！ゴゴゴゴ！',
    c79: '消えろ…',
    c80: '覚悟はいいか？',
    c81: 'プロシュートの兄貴ィィ！',
    c87: 'ブラーヴォ！ブラーヴォ！',
    c88: 'シェフィィィィ！',
    // Part 6
    c90: 'キッス！',
    c92: 'ジョルノ、娘を俺にくれ',
    c94: '天国へ行こう',
    c95: '…生き残れ',
    // Part 7
    c103: 'タスクアクト！',
    c105: 'Muda Muda Muda!',
    c116: '真の男とは自分の行動に責任を持つ者だ',
    // Part 8
    c120: 'ソフト＆ウェット！ワワワワ！',
    c129: 'ワンダー・オブ・U…',
    // Part 9
    c135: '俺は成功者になる',
  };

  if (window.FALLBACK_DATA && window.FALLBACK_DATA.characters) {
    window.FALLBACK_DATA.characters.forEach(function (c) {
      if (CHAR_IMGS[c.id])     c.image       = BASE + CHAR_IMGS[c.id];
      if (CATCHPHRASES[c.id])  c.catchphrase = CATCHPHRASES[c.id];
    });
  }
})();
