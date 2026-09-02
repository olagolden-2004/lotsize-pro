import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const platform = body.platform;
    const platformUserId = body.platformUserId;
    const instrument = body.instrument;

    if (!platform || !platformUserId) {
      return NextResponse.json(
        { error: "User information is required." },
        { status: 400 }
      );
    }

    // Find or create the user
    let { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("platform", platform)
      .eq("platform_user_id", platformUserId)
      .maybeSingle();

    if (userError) {
      throw userError;
    }

    if (!user) {
      const { data: newUser, error: createError } = await supabaseAdmin
        .from("users")
        .insert({
          platform,
          platform_user_id: platformUserId,
          last_seen_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (createError) {
        throw createError;
      }

      user = newUser;
    } else {
      const { error: updateError } = await supabaseAdmin
        .from("users")
        .update({
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }
    }

    // Record the calculation
    const { error: usageError } = await supabaseAdmin
      .from("usage_events")
      .insert({
        user_id: user.id,
        event_type: "calculation",
        instrument: instrument || null,
      });

    if (usageError) {
      throw usageError;
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Usage tracking error:", error);

    return NextResponse.json(
      { error: "Unable to record usage." },
      { status: 500 }
    );
  }
        }
