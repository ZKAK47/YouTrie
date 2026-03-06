export const LCSHelper = {
    findArrayMoveDiff(array, elementsToMove, finalPos) {
        let updatedArray = [...array]
        let remainingElements = [...elementsToMove]
        let insertAt = finalPos
        const moves = []
        
        console.log("Départ:", updatedArray.map((v, i) => `${i}:${v}`).join(', '))
        
        let groupToMove = findNextGroup(updatedArray, remainingElements)
        
        while (groupToMove.length) {
          const movingElementsNum = groupToMove.length
          const firstElement = groupToMove[0]
          const lastElement = groupToMove[movingElementsNum - 1]
          
          // Trouver les positions actuelles
          const headIndex = updatedArray.findIndex(e => e === firstElement)
          const tailIndex = updatedArray.findIndex(e => e === lastElement)
          
          console.log(`\nGroupe [${groupToMove}] à ${headIndex}-${tailIndex}, cible: ${insertAt}`)
          
          // Cas: groupe déjà à la bonne place ou chevauche la cible
          const inBetween = (insertAt > headIndex && insertAt < tailIndex)
          const exactPosition = (headIndex === insertAt)
          
          if (inBetween || exactPosition) {
            console.log("  Chevauchement, on passe au groupe suivant")
            remainingElements = remainingElements.slice(movingElementsNum)
            groupToMove = findNextGroup(updatedArray, remainingElements)
            continue
          }
          
          const upToDown = tailIndex < insertAt  // Groupe avant la cible
          const downToUp = headIndex > insertAt   // Groupe après la cible
          
          if (upToDown) {
            // Groupe avant la cible: éléments entre tailIndex et insertAt
            const elementsBetween = insertAt - tailIndex - 1
            console.log(`  Groupe avant cible, ${elementsBetween} éléments entre`)
            
            if (elementsBetween < movingElementsNum && elementsBetween > 0) {
              // Plus économique: déplacer les éléments entre APRÈS le groupe
              console.log(`  Déplacer les ${elementsBetween} éléments entre`)
              
              const betweenElements = updatedArray.splice(tailIndex + 1, elementsBetween)
              updatedArray.splice(headIndex, 0, ...betweenElements)
              
              for (let i = 0; i < elementsBetween; i++) {
                moves.push({
                  element: betweenElements[i],
                  from: tailIndex + 1 + i,
                  to: headIndex + i
                })
              }
            } else {
              // Plus économique: déplacer le groupe
              console.log(`  Déplacer le groupe entier (${movingElementsNum} éléments)`)
              
              const groupElements = updatedArray.splice(headIndex, movingElementsNum)
              const newPos = insertAt
              updatedArray.splice(newPos, 0, ...groupElements)
              
              for (let i = 0; i < movingElementsNum; i++) {
                moves.push({
                  element: groupElements[i],
                  from: headIndex + i,
                  to: newPos
                })
              }
            }
            
          } else if (downToUp) {
            // Groupe après la cible: éléments entre insertAt et headIndex
            const elementsBetween = headIndex - insertAt
            console.log(`  Groupe après cible, ${elementsBetween} éléments entre`)
            
            if (elementsBetween < movingElementsNum && elementsBetween > 0) {
              // Plus économique: déplacer les éléments entre AVANT le groupe
              console.log(`  Déplacer les ${elementsBetween} éléments entre`)
              
              const betweenElements = updatedArray.splice(insertAt, elementsBetween)
              updatedArray.splice(tailIndex - elementsBetween + 1, 0, ...betweenElements)
              
              for (let i = 0; i < elementsBetween; i++) {
                moves.push({
                  element: betweenElements[i],
                  from: insertAt + i,
                  to: tailIndex - elementsBetween + 1 + i
                })
              }
            } else {
              // Plus économique: déplacer le groupe
              console.log(`  Déplacer le groupe entier (${movingElementsNum} éléments)`)
              
              const groupElements = updatedArray.splice(headIndex, movingElementsNum)
              updatedArray.splice(insertAt, 0, ...groupElements)
              
              for (let i = 0; i < movingElementsNum; i++) {
                moves.push({
                  element: groupElements[i],
                  from: headIndex + i,
                  to: insertAt + i
                })
              }
            }
          }
          
          // Mettre à jour remainingElements
          remainingElements = remainingElements.slice(movingElementsNum)
          
          const newLastIndex = updatedArray.findIndex(e => e === lastElement)
          insertAt = newLastIndex + 1
          
          groupToMove = findNextGroup(updatedArray, remainingElements)
        }
        
        return {
          finalArray: updatedArray,
          moves: moves,
          totalMoves: moves.length  // Chaque élément déplacé compte pour 1
        }
      }
}

function findNextGroup(allElements, specificsElements) {
  if (!specificsElements.length) return []
  
  let result = []
  let specificsIndex = 0
  
  for (let i = 0; i < allElements.length; i++) {
    if (specificsIndex >= specificsElements.length) break
    
    if (allElements[i] === specificsElements[specificsIndex]) {
      result.push(specificsElements[specificsIndex])
      specificsIndex++
    } else if (result.length > 0) {
      break
    }
  }
  
  return result
}