import { prisma } from "../lib/prisma"

async function updatePermalinks() {
  console.log("Starting permalink update...")
  
  // Get all questions without permalinks
  const questions = await prisma.question.findMany({
    where: {
      itemPermalink: null
    },
    select: {
      id: true,
      itemId: true
    }
  })
  
  console.log(`Found ${questions.length} questions without permalinks`)
  
  for (const question of questions) {
    try {
      // Fetch item details from ML API
      const response = await fetch(`https://api.mercadolibre.com/items/${question.itemId}`)
      
      if (response.ok) {
        const data = await response.json()
        
        if (data.permalink) {
          await prisma.question.update({
            where: { id: question.id },
            data: { itemPermalink: data.permalink }
          })
          
          console.log(`✅ Updated permalink for item ${question.itemId}`)
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
  
  console.log("Permalink update completed!")
  process.exit(0)
}

updatePermalinks().catch(console.error)