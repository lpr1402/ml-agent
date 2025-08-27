import { NextRequest, NextResponse } from "next/server"
import { extractAuthHeader } from "@/lib/auth-server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const auth = await extractAuthHeader(request)
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    const { itemId } = await params
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get("limit") || "20"
    const offset = searchParams.get("offset") || "0"

    // Fetch reviews from Mercado Livre API
    const response = await fetch(
      `https://api.mercadolibre.com/reviews/item/${itemId}?limit=${limit}&offset=${offset}`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ 
          reviews: [],
          paging: {
            total: 0,
            offset: 0,
            limit: parseInt(limit)
          },
          rating_average: 0,
          rating_levels: {
            one_star: 0,
            two_star: 0,
            three_star: 0,
            four_star: 0,
            five_star: 0
          }
        }, { status: 200 }) // Return 200 with empty data
      }
      return NextResponse.json(
        { error: "Failed to fetch reviews" },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Calculate rating distribution if reviews exist
    const ratingLevels = {
      one_star: 0,
      two_star: 0,
      three_star: 0,
      four_star: 0,
      five_star: 0
    }

    if (data.reviews && data.reviews.length > 0) {
      data.reviews.forEach((review: any) => {
        const rating = review.rating || review.rate
        switch(rating) {
          case 1: ratingLevels.one_star++; break
          case 2: ratingLevels.two_star++; break
          case 3: ratingLevels.three_star++; break
          case 4: ratingLevels.four_star++; break
          case 5: ratingLevels.five_star++; break
        }
      })
    }

    // Transform reviews to cleaner format
    const transformedReviews = (data.reviews || []).map((review: any) => ({
      id: review.id,
      title: review.title || "",
      content: review.content || "",
      rating: review.rating || review.rate || 0,
      dateCreated: review.date_created || review.date || null,
      helpfulVotes: review.valorization?.helpful || 0,
      notHelpfulVotes: review.valorization?.not_helpful || 0,
      buyerName: review.reviewer_name || "Comprador",
      status: review.status || "approved",
      likesCount: review.likes || 0,
      dislikesCount: review.dislikes || 0
    }))

    const result = {
      reviews: transformedReviews,
      paging: data.paging || {
        total: transformedReviews.length,
        offset: parseInt(offset),
        limit: parseInt(limit)
      },
      rating_average: data.rating_average || 0,
      rating_levels: ratingLevels
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching reviews:", error)
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    )
  }
}