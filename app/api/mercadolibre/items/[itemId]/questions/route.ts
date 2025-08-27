import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest } from "../../../base"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    const params = await context.params
    const itemId = params.itemId
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || "unanswered"
    const limit = searchParams.get("limit") || "10"

    // Get questions for the item
    const questionsResponse = await fetch(
      `https://api.mercadolibre.com/questions/search?item=${itemId}&status=${status}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      }
    )

    if (!questionsResponse.ok) {
      // If no questions or error, return empty structure
      return NextResponse.json({
        item_id: itemId,
        questions: [],
        total: 0,
        unanswered: 0,
        answered: 0,
        message: "No questions found for this item"
      })
    }

    const questionsData = await questionsResponse.json()
    
    // Process and format the questions data
    const processedQuestions = (questionsData.questions || []).map((question: any) => ({
      id: question.id,
      text: question.text,
      status: question.status,
      date_created: question.date_created,
      item_id: question.item_id,
      seller_id: question.seller_id,
      from: {
        id: question.from?.id,
        nickname: question.from?.nickname,
      },
      answer: question.answer ? {
        text: question.answer.text,
        status: question.answer.status,
        date_created: question.answer.date_created,
      } : null,
    }))

    // Count answered and unanswered questions
    const unansweredCount = processedQuestions.filter((q: any) => !q.answer).length
    const answeredCount = processedQuestions.filter((q: any) => q.answer).length

    return NextResponse.json({
      item_id: itemId,
      questions: processedQuestions,
      total: questionsData.total || processedQuestions.length,
      unanswered: unansweredCount,
      answered: answeredCount,
      paging: questionsData.paging || {},
    })
    
  } catch (error) {
    console.error("Error fetching questions:", error)
    return NextResponse.json(
      { 
        questions: [],
        total: 0,
        unanswered: 0,
        answered: 0,
        error: "Failed to fetch questions" 
      },
      { status: 500 }
    )
  }
}