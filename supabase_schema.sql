-- 구독자 정보 테이블
create table if not exists subscriptions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_name text not null,
  phone text not null,
  hexagram_code text not null, -- 괘 코드 (예: "111111")
  moving_lines jsonb, -- 동효 인덱스 배열 (예: [0, 5])
  question text,
  situation text,
  current_week int default 1,
  status text default 'active', -- 'active', 'completed', 'cancelled'
  started_at timestamp with time zone default timezone('utc'::text, now())
);

-- 전화번호로 검색하기 위한 인덱스
create index if not exists subscriptions_phone_idx on subscriptions (phone);

-- 주차별 활동 로그 테이블 (AI 생성 내용 및 사용자 감정)
create table if not exists weekly_logs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  subscription_id uuid references subscriptions(id),
  week_number int not null,
  user_emotion text, -- 사용자가 입력한 감정/피드백
  ai_content jsonb -- { koan, reflection, action_item } JSON 객체
);

-- RLS (Row Level Security) 설정 - 필요 시 활성화
-- alter table subscriptions enable row level security;
-- alter table weekly_logs enable row level security;