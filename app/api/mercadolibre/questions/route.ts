import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest } from "../base"

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || ""
    
    // Fetch user data first
    const userResponse = await fetch("https://api.mercadolibre.com/users/me", {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
      },
    })

    if (!userResponse.ok) {
      throw new Error("Failed to fetch user data")
    }

    const userData = await userResponse.json()
    const sellerId = userData.id

    // Build URL with parameters
    let url = `https://api.mercadolibre.com/questions/search?seller_id=${sellerId}&api_version=4&limit=50`
    if (status) {
      url += `&status=${status}`
    }

    // Fetch questions
    const questionsResponse = await fetch(url, {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
      },
    })

    if (!questionsResponse.ok) {
      throw new Error("Failed to fetch questions")
    }

    const questionsData = await questionsResponse.json()

    // Process questions to add more details
    const questions = questionsData.questions || []
    
    // Fetch item details for recent questions
    const recentQuestions = await Promise.all(
      questions.slice(0, 5).map(async (q: any) => {
        try {
          // Try to fetch item title
          const itemResponse = await fetch(`https://api.mercadolibre.com/items/${q.item_id}`, {
            headers: {
              Authorization: `Bearer ${auth.accessToken}`,
            },
          })
          
          const itemData = itemResponse.ok ? await itemResponse.json() : null
          
          return {
            id: q.id,
            text: q.text,
            status: q.status,
            date_created: q.date_created,
            item_id: q.item_id,
            item_title: itemData?.title || null,
            answer: q.answer,
          }
        } catch (error) {
          return {
            id: q.id,
            text: q.text,
            status: q.status,
            date_created: q.date_created,
            item_id: q.item_id,
            item_title: null,
            answer: q.answer,
          }
        }
      })
    )
    
    // Count by status
    const stats = {
      total: questionsData.total || 0,
      unanswered: questions.filter((q: any) => q.status === "UNANSWERED").length,
      answered: questions.filter((q: any) => q.status === "ANSWERED").length,
      banned: questions.filter((q: any) => q.status === "BANNED").length,
    }

    return NextResponse.json({
      questions: questions.slice(0, 20), // Return last 20 questions
      recent: recentQuestions,
      stats,
      total: questionsData.total,
    })
  } catch (error) {
    console.error("Error fetching questions:", error)
    return NextResponse.json(
      { error: "Failed to fetch questions" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    const body = await request.json()
    const { questionId, text } = body

    if (!questionId || !text) {
      return NextResponse.json(
        { error: "Question ID and text are required" },
        { status: 400 }
      )
    }

    // Post answer
    const response = await fetch("https://api.mercadolibre.com/answers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question_id: questionId,
        text: text,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || "Failed to post answer")
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error posting answer:", error)
    return NextResponse.json(
      { error: "Failed to post answer" },
      { status: 500 }
    )
  }
}