export const NIGHT_LINES = ["안 자?", "졸려", "코 자", "쉬잇", "꿈 꿔", "하암", "zZ", "쿨쿨"];
export function isPetNight(now = Date.now()) {
  return Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul", hour: "2-digit", hourCycle: "h23",
  }).format(now)) < 6;
}
export function koreanDate(now = Date.now()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(now);
}
export interface SecretPet {
  id: number; group_name: string; generation_number: number;
  species: string; pet_name: string | null; stage: string;
  adult_at: string | null; died_at: string | null;
}
export function canLeaveNote(pet: SecretPet, now = Date.now()) {
  return ["baby", "teen", "adult"].includes(pet.stage) && !pet.died_at &&
    (!pet.adult_at || Date.parse(pet.adult_at) + 14 * 86400000 > now);
}
const NOTES: Record<string, Record<string, string[]>> = {
  bogli: {
    baby: ["이거 비미리야! 너 보면 방울방울 기분 조아져!", "글씨 쪼끔 삐뚤해도 내 마음은 동그라미야!"],
    teen: ["종이를 접었는데 내 마음도 쪼꼬매졌어. 펼치면 엄청 커!", "나 멋진 비밀 요원 같지? 쉿! 웃음이 먼저 새어 나와!"],
    adult: ["비밀 하나 알려줄까? 어른이 되어도 마음속 방울은 자꾸 톡톡 터져!", "글씨는 조금 늘었는데 숨바꼭질은 아직 서툴러. 내 쪽지, 잘 찾았네!"],
  },
  bosongi: {
    baby: ["저어… 작은 마음을 접어 봤어요. 받아 주실래요?", "아직 글씨가 작아요. 좋아하는 마음은 이만큼 커요. ♡"],
    teen: ["말로 하면 부끄러워서 쪽지에 살짝 담았어요. 오늘도 포근하시길요.", "제 마음 한쪽에 작은 자리를 비워 두었어요. 쉬어 가셔도 좋아요."],
    adult: ["곁에 있다는 말을 조용히 전하고 싶었어요. 이 쪽지가 작은 온기가 되면 좋겠어요.", "수줍음은 여전하지만, 다정한 마음은 숨기지 않으려고요. ♡"],
  },
  byeolkongi: {
    baby: ["별님한테 비밀 말했어. 너한테도 반짝!", "달이 종이배면 좋겠어. 같이 둥실 갈래?"],
    teen: ["이 종이 모서리를 접으면 작은 별자리가 될까? 이름은 우리만 알자.", "달빛 우편함을 상상했어. 첫 편지는 너에게 보내고 싶었어."],
    adult: ["멀리 있는 별도 작은 빛으로 말을 걸지. 내 마음도 이 종이만큼의 빛이면 충분해.", "언젠가 꿈에서 같은 달을 만나면, 오늘의 비밀을 별자리처럼 펼쳐 보자."],
  },
  dungdungi: {
    baby: ["쪽지… 냠? 아냐, 먹는 거 아냐. 헤헤, 졸려…", "작은 구름 베개 있으면… 반 나눠 줄게. 하암."],
    teen: ["비밀 간식은 상상 속에 숨겼어… 찾으면 반 나누자. 느긋하게.", "종이 접는 건 나중에… 이대로도 포근한 편지 같지? 하암."],
    adult: ["급한 마음은 잠깐 내려놔도 돼… 따뜻한 한입 같은 쉼을 너에게 주고 싶어.", "꿈속 식탁엔 의자를 하나 더 놓을래… 같이 느긋하게 구름 맛을 상상하자."],
  },
  hornkong: {
    baby: ["흥! 너 주려고 쓴 건… 마자. 쪼끔만 좋아해!", "내 글씨 귀엽다고 웃지 마! …조금은 웃어도 돼."],
    teen: ["이런 쪽지 자주 쓰는 거 아니거든? 그러니까 잘 읽어. 딱 한 번만!", "우연히 네 생각이 났을 뿐이야. 여러 번은 아니고… 몰라!"],
    adult: ["꼭 전하고 싶은 말이라 쓴 거야. 네가 소중하다는 말. …다시 읽어 주진 않을 거야!", "무심한 척하는 것도 은근 어렵네. 이 쪽지 앞에선 조금 솔직해져도 되겠지."],
  },
  kongmongi: {
    baby: ["짠! 종이 속에서 내가 튀어나오면? 깜짝! 히히!", "비밀 작전! 이 쪽지 읽고 혼자 씩 웃기!"],
    teen: ["특급 임무 도착! 오늘 상상 속에 거꾸로 걷는 구름 하나 띄우기!", "쪽지를 접으면 비행기, 펼치면 내 장난! 어느 쪽이 더 웃겨?"],
    adult: ["어른도 엉뚱한 비밀 하나쯤 있어야지. 내 머릿속엔 우산 쓴 물고기가 춤추고 있어!", "작전명은 슬쩍 미소! 평범한 순간에 작은 장난을 숨기는 거야. 너도 공범 할래?"],
  },
};
export function secretMessage(pet: SecretPet, random = Math.random()) {
  const lines = NOTES[pet.species]?.[pet.stage];
  if (!lines) return null;
  return { body: lines[Math.min(lines.length - 1, Math.floor(Math.max(0, random) * lines.length))],
    signature: pet.pet_name?.trim() || `${pet.generation_number}세대` };
}
