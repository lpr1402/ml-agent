import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest } from "../base"

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get("item_id")

    // If no item_id provided, return empty reviews
    if (!itemId) {
      return NextResponse.json({
        reviews: [],
        rating_average: 0,
        rating_levels: {
          one_star: 0,
          two_star: 0,
          three_star: 0,
          four_star: 0,
          five_star: 0
        },
        total: 0,
        message: "No item_id provided"
      })
    }

    // Get reviews for the specific item
    const reviewsResponse = await fetch(
      `https://api.mercadolibre.com/reviews/item/${itemId}`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      }
    )

    if (!reviewsResponse.ok) {
      // If item has no reviews or error, return empty structure
      return NextResponse.json({
        item_id: itemId,
        reviews: [],
        rating_average: 0,
        rating_levels: {
          one_star: 0,
          two_star: 0,
          three_star: 0,
          four_star: 0,
          five_star: 0
        },
        total: 0,
        message: "No reviews found for this item"
      })
    }

    const reviewsData = await reviewsResponse.json()
    
    // Process and format the reviews data
    const processedReviews = (reviewsData.reviews || []).map((review: any) => ({
      id: review.id,
      title: review.title,
      content: review.content,
      rate: review.rate,
      date_created: review.date_created,
      buying_date: review.buying_date,
      likes: review.likes || 0,
      dislikes: review.dislikes || 0,
      status: review.status
    }))

    // Calculate total reviews count
    const totalReviews = Object.values(reviewsData.rating_levels || {}).reduce(
      (sum: any, count: any) => sum + count, 0
    )

    return NextResponse.json({
      item_id: itemId,
      reviews: processedReviews.slice(0, 10), // Return max 10 reviews
      rating_average: reviewsData.rating_average || 0,
      rating_levels: reviewsData.rating_levels || {
        one_star: 0,
        two_star: 0,
        three_star: 0,
        four_star: 0,
        five_star: 0
      },
      total: totalReviews,
      paging: reviewsData.paging || {}
    })
    
  } catch (error) {
    console.error("Error fetching reviews:", error)
    return NextResponse.json(
      { 
        reviews: [],
        rating_average: 0,
        rating_levels: {
          one_star: 0,
          two_star: 0,
          three_star: 0,
          four_star: 0,
          five_star: 0
        },
        total: 0,
        error: "Failed to fetch reviews" 
      },
      { status: 500 }
    )
  }
}