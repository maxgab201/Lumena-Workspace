-- Create custom types for billing
CREATE TYPE plan_type AS ENUM ('free', 'pro', 'team', 'enterprise');
CREATE TYPE transaction_type AS ENUM ('grant', 'purchase', 'usage');

-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan plan_type NOT NULL DEFAULT 'free',
  credits_remaining INTEGER NOT NULL DEFAULT 50, -- free tier default
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  amount INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Subscriptions Policies
CREATE POLICY "Users can view their own subscription"
  ON public.subscriptions FOR SELECT
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can update their own subscription"
  ON public.subscriptions FOR UPDATE
  USING ( auth.uid() = user_id );

-- Transactions Policies
CREATE POLICY "Users can view their own transactions"
  ON public.transactions FOR SELECT
  USING ( auth.uid() = user_id );

-- Insert transaction and update subscription function (for atomic credit usage)
CREATE OR REPLACE FUNCTION public.consume_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_credits_remaining INTEGER;
BEGIN
  -- Lock the subscription row
  SELECT credits_remaining INTO v_credits_remaining
  FROM public.subscriptions
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_credits_remaining IS NULL OR v_credits_remaining < p_amount THEN
    RETURN FALSE;
  END IF;

  -- Deduct credits
  UPDATE public.subscriptions
  SET credits_remaining = credits_remaining - p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Record transaction
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'usage', -p_amount, p_description);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create default subscription on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, credits_remaining)
  VALUES (new.id, 'free', 50);

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (new.id, 'grant', 50, 'Initial Free Tier Grant');

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_subscription();

-- Backfill subscriptions for existing profiles
INSERT INTO public.subscriptions (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;
