// TCS Analysis Service - Migrated from TheClearScope
// Generates comprehensive Xactimate analysis with room-based structure

import { callAI } from './ai'
import { XactimateAnalysis, RoomAnalysis, XactimateLineItem } from '@/types/xactimate-analysis'
import { searchByKeyword, findByCode } from './xactimate-lookup'

export interface TCSAnalysisOptions {
  images: string[] // Base64 image data URLs
  damageDescription: string
  userType?: string
  userLocation?: string
}

export async function generateTCSAnalysis(options: TCSAnalysisOptions): Promise<XactimateAnalysis> {
  const { images, damageDescription, userType, userLocation } = options

  // Create comprehensive prompt for TCS Professional Analysis
  const analysisPrompt = `
Analyze these construction/damage photos and create a COMPREHENSIVE, PROFESSIONAL Xactimate-style analysis.

CRITICAL: This is a TCS (The Clear Scope) Professional Analysis. You must provide detailed, room-by-room analysis with structured line items.

ANALYSIS REQUIREMENTS:
1. Identify ALL rooms/locations visible in the photos
2. For EACH room, provide:
   - Room type (Kitchen, Living Room, Bedroom, Bathroom, etc.)
   - Damage category (Water Damage, Fire Damage, Storm Damage, etc.)
   - Water category if applicable (Category 1, Category 2, Category 3)
   - Severity level (Minor, Moderate, Major, Severe)
   - Detailed line items for that room
3. For EACH line item, provide:
   - Category (Flooring, Drywall, Paint, Electrical, Emergency Services, etc.)
   - Title (brief summary)
   - Description (detailed description of work)
   - Damage Code (WTR=Water, FR=Fire, STM=Storm, MUD=Mud, etc.)
   - Labor Type (Demo, Install, Paint, Repair, Extract, Clean, Sanitize, Prep, Finish, Prime, Tape, Mud, Texture)
   - Material Grade (Standard, Premium, Economy)
   - Process Code if applicable (WTR EXTMS, WTR DEBRS, WTR AMB, CNT MVMOVE, PLS COV, etc.)
   - Notes if needed

DAMAGE CODES:
- WTR = Water damage
- FR = Fire damage
- STM = Storm damage
- MUD = Mud/soil damage
- WND = Wind damage
- HIL = Hail damage
- OTH = Other damage

LABOR TYPES:
- Demo = Demolition/removal
- Install = Installation
- Paint = Painting
- Repair = Repair work
- Extract = Water extraction
- Clean = Cleaning
- Sanitize = Sanitization
- Prep = Preparation
- Finish = Finishing work
- Prime = Priming
- Tape = Taping
- Mud = Mudding
- Texture = Texturing

WATER CATEGORIES (for water damage):
- Category 1: Clean water (e.g., broken supply line)
- Category 2: Gray water (e.g., washing machine overflow)
- Category 3: Black water (e.g., sewage backup)

SEVERITY LEVELS:
- Minor: Minimal damage, easy repair
- Moderate: Noticeable damage, standard repair
- Major: Significant damage, extensive repair
- Severe: Critical damage, major reconstruction

USER CONTEXT:
${userType ? `User Type: ${userType}` : ''}
${userLocation ? `Location: ${userLocation}` : ''}

DAMAGE DESCRIPTION:
${damageDescription}

Return your response as JSON in this exact format:
{
  "rooms": [
    {
      "roomType": "Kitchen",
      "damageCategory": "Water Damage",
      "waterCategory": "Category 2",
      "severityLevel": "Moderate",
      "notes": "Water damage from dishwasher leak",
      "lineItems": [
        {
          "category": "Drywall",
          "title": "Remove damaged drywall",
          "description": "Remove and dispose of water-damaged drywall from lower 24 inches of kitchen walls",
          "damageCode": "WTR",
          "laborType": "Demo",
          "materialGrade": "Standard",
          "processCode": "WTR DEBRS",
          "notes": "Affected area approximately 48 square feet"
        }
      ]
    }
  ],
  "overallDamageCategory": "Water Damage",
  "projectNotes": "Overall project notes and observations"
}

CRITICAL: 
- Return ONLY valid JSON. No markdown, no explanations.
- Be thorough - identify ALL visible damage and needed work.
- Organize by room for clarity.
- Use proper damage codes, labor types, and categories.
- Include process codes where applicable.
`

  // Call OpenAI with vision API
  const imageDataUrls = images // Already in data URL format
  
  const aiResponse = await callAI({
    prompt: analysisPrompt,
    toolId: 'photoxact',
    systemPrompt: `You are an expert Xactimate estimator performing TCS (The Clear Scope) Professional Analysis. Your task is to create comprehensive, room-by-room damage assessments with detailed line items.

CRITICAL REQUIREMENTS:
1. Identify ALL rooms visible in photos
2. For each room, provide complete damage assessment
3. Create detailed line items with proper categorization
4. Use correct damage codes, labor types, and process codes
5. Be thorough and professional
6. Organize by room for clarity

Your analysis must be professional, complete, and ready for use in construction estimates.`,
    imageUrl: imageDataUrls[0], // Use first image for vision API
    temperature: 0.1,
    maxTokens: 8000,
    model: 'gpt-4o',
  })

  if (aiResponse.error) {
    throw new Error(`TCS Analysis failed: ${aiResponse.error}`)
  }

  // Parse AI response
  let result
  try {
    let cleaned = aiResponse.result.trim()
    cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response')
    }
    result = JSON.parse(jsonMatch[0])
  } catch (parseError: any) {
    console.error('[TCS Analysis] Parse error:', parseError)
    console.error('[TCS Analysis] AI Response:', aiResponse.result.substring(0, 500))
    throw new Error(`Failed to parse TCS Analysis: ${parseError.message}`)
  }

  // Convert to XactimateAnalysis structure
  const rooms: RoomAnalysis[] = (result.rooms || []).map((room: any) => {
    const lineItems: XactimateLineItem[] = (room.lineItems || []).map((item: any) => {
      // Try to find Xactimate code for this item
      let code: string | undefined
      if (item.category && item.description) {
        const matches = searchByKeyword(`${item.category} ${item.description}`, 5)
        if (matches.length > 0) {
          code = matches[0].code
        }
      }

      return {
        category: item.category || '',
        title: item.title || item.description || '',
        description: item.description || '',
        damageCode: item.damageCode || 'OTH',
        laborType: item.laborType || 'Repair',
        materialGrade: item.materialGrade || 'Standard',
        processCode: item.processCode,
        notes: item.notes,
        code,
      } as XactimateLineItem
    })

    return {
      roomType: room.roomType || 'Unknown',
      lineItems,
      damageCategory: room.damageCategory || 'Unknown',
      waterCategory: room.waterCategory,
      severityLevel: room.severityLevel,
      notes: room.notes,
    } as RoomAnalysis
  })

  const analysis: XactimateAnalysis = {
    rooms,
    overallDamageCategory: result.overallDamageCategory || 'Unknown',
    projectNotes: result.projectNotes,
    createdAt: new Date(),
    mainReportContent: result.mainReportContent,
  }

  return analysis
}
