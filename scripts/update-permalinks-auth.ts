import { prisma } from "../lib/prisma"
import { tokenManager } from "../lib/token-manager"

async function updatePermalinksWithAuth() {
  console.log("Starting permalink update with authentication...")
  
  // Get all questions without permalinks
  const questions = await prisma.question.findMany({
    where: {
      itemPermalink: null
    },
    select: {
      id: true,
      itemId: true,
      mlUserId: true
    }
  })
  
  console.log(`Found ${questions.length} questions without permalinks`)
  
  // Group by seller to use their tokens
  const questionsBySeller = questions.reduce((acc, q) => {
    if (!acc[q.mlUserId]) acc[q.mlUserId] = []
    acc[q.mlUserId].push(q)
    return acc
  }, {} as Record<string, typeof questions>)
  
  for (const [sellerId, sellerQuestions] of Object.entries(questionsBySeller)) {
    // Get seller's token
    const accessToken = await tokenManager.getAccessToken(sellerId)
    
    if (!accessToken) {
      console.log(`⚠️ No access token for seller ${sellerId}, using public API`)
    }
    
    for (const question of sellerQuestions) {
      try {
        // Fetch item details from ML API
        const headers: any = {
          "Accept": "application/json"
        }
        
        if (accessToken) {
          headers["Authorization"] = `Bearer ${accessToken}`
        }
        
        const response = await fetch(`https://api.mercadolibre.com/items/${question.itemId}`, {
          headers
        })
        
        if (response.ok) {
          const data = await response.json()
          
          if (data.permalink) {
            await prisma.question.update({
              where: { id: question.id },
              data: { itemPermalink: data.permalink }
            })
            
            console.log(`✅ Updated permalink for item ${question.itemId}: ${data.permalink}`)
          }
        } else {
          console.log(`❌ Failed to fetch item ${question.itemId}: ${response.status}`)
        }
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
        
      } catch (error) {
        console.error(`Error updating item ${question.itemId}:`, error)
      }
    }
  }
  
  console.log("Permalink update completed!")
  process.exit(0)
}

updatePermalinksWithAuth().catch(console.error)