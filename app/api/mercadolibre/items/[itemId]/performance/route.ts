import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest } from "../../../base"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request)
    const { itemId } = await params
    
    if (!auth?.accessToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }
    
    // Try the new performance API first (replaces the deprecated health API)
    const performanceResponse = await fetch(
      `https://api.mercadolibre.com/items/${itemId}/performance`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      }
    )

    if (performanceResponse.ok) {
      const data = await performanceResponse.json()
      
      // Process the performance data to extract key metrics
      const processedData = {
        score: data.score || 0,
        level: data.level || "Unknown",
        level_wording: data.level_wording || data.level,
        calculated_at: data.calculated_at,
        
        // Extract key metrics from buckets
        characteristics: {},
        offer: {},
        
        // Overall status
        hasIssues: false,
        pendingActions: [] as any[],
        completedActions: [] as any[]
      }
      
      // Process buckets for detailed metrics
      if (data.buckets) {
        data.buckets.forEach((bucket: any) => {
          if (bucket.key === "CHARACTERISTICS") {
            processedData.characteristics = {
              status: bucket.status,
              score: bucket.score,
              title: bucket.title,
              variables: bucket.variables?.map((v: any) => ({
                key: v.key,
                title: v.title,
                status: v.status,
                score: v.score
              }))
            }
          } else if (bucket.key === "OFFER") {
            processedData.offer = {
              status: bucket.status,
              score: bucket.score,
              title: bucket.title,
              variables: bucket.variables?.map((v: any) => ({
                key: v.key,
                title: v.title,
                status: v.status,
                score: v.score
              }))
            }
          }
          
          // Extract pending actions
          bucket.variables?.forEach((variable: any) => {
            variable.rules?.forEach((rule: any) => {
              if (rule.status === "PENDING") {
                processedData.hasIssues = true
                processedData.pendingActions.push({
                  title: rule.wordings?.title || variable.title,
                  label: rule.wordings?.label,
                  link: rule.wordings?.link,
                  progress: rule.progress
                })
              } else if (rule.status === "COMPLETED") {
                processedData.completedActions.push({
                  title: rule.wordings?.title || variable.title
                })
              }
            })
          })
        })
      }
      
      return NextResponse.json({ 
        data: processedData,
        raw: data // Include raw data for detailed analysis if needed
      })
    }

    // If performance API fails, return error
    return NextResponse.json(
      { error: "Performance data not available" },
      { status: performanceResponse.status }
    )
  } catch (error) {
    console.error("Error fetching item performance:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}