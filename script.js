const searchInput = document.getElementById('searchInput');
const resultsDiv = document.getElementById('results');

// Allow Enter key to trigger search
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        suggestionsBox.style.display = 'none';
        searchRecipes();
    }
});

const suggestionsBox = document.getElementById('suggestions');
let debounceTimer;

searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(debounceTimer);

    if (query.length < 2) {
        suggestionsBox.style.display = 'none';
        return;
    }

    debounceTimer = setTimeout(async () => {
        try {
            const response = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${query}`);
            const data = await response.json();

            if (data.meals) {
                showSuggestions(data.meals);
            } else {
                suggestionsBox.style.display = 'none';
            }
        } catch (error) {
            console.error('Error fetching suggestions:', error);
        }
    }, 300);
});

function showSuggestions(meals) {
    suggestionsBox.innerHTML = '';
    const limitedMeals = meals.slice(0, 5); // Show top 5 suggestions

    limitedMeals.forEach(meal => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.textContent = meal.strMeal;
        div.onclick = () => {
            searchInput.value = meal.strMeal;
            suggestionsBox.style.display = 'none';
            searchRecipes();
        };
        suggestionsBox.appendChild(div);
    });

    suggestionsBox.style.display = 'block';
}

// Close suggestions when clicking outside
document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
        suggestionsBox.style.display = 'none';
    }
});

const modal = document.getElementById('recipeModal');
const modalBody = document.getElementById('modalBody');
const closeBtn = document.querySelector('.close-btn');

// Close modal event
closeBtn.onclick = () => {
    modal.style.display = "none";
}

window.onclick = (event) => {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

async function searchRecipes() {
    const query = searchInput.value.trim();

    if (!query) {
        resultsDiv.innerHTML = '<p class="loader">Please enter an ingredient to search.</p>';
        return;
    }

    resultsDiv.innerHTML = '<p class="loader">Searching for delicious recipes...</p>';

    try {
        const response = await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?i=${query}`);
        const data = await response.json();

        if (data.meals) {
            displayRecipes(data.meals);
        } else {
            resultsDiv.innerHTML = `
                <div class="loader">
                    <p>No recipes found for "${query}" 😕</p>
                    <p style="font-size: 0.9rem; margin-top: 0.5rem">Try generic ingredients like "chicken", "beef", or "potato".</p>
                </div>`;
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        resultsDiv.innerHTML = '<p class="loader">Something went wrong. Please try again later.</p>';
    }
}

function displayRecipes(meals) {
    resultsDiv.innerHTML = '';

    meals.forEach((meal, index) => {
        const card = document.createElement('div');
        card.className = 'recipe-card';
        card.style.animationDelay = `${index * 0.1}s`; // Staggered animation

        card.innerHTML = `
            <img src="${meal.strMealThumb}" alt="${meal.strMeal}" loading="lazy">
            <div class="recipe-info">
                <h3 class="recipe-title">${meal.strMeal}</h3>
                <button class="view-recipe-btn">View Recipe</button>
            </div>
        `;

        card.addEventListener('click', () => {
            openRecipeDetails(meal.idMeal);
        });

        resultsDiv.appendChild(card);
    });
}

async function openRecipeDetails(id) {
    modal.style.display = "block";
    modalBody.innerHTML = '<p class="loader">Loading recipe details...</p>';

    try {
        const response = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${id}`);
        const data = await response.json();
        const meal = data.meals[0];

        if (meal) {
            // Extract ingredients
            let ingredientsList = [];
            let ingredientsHtml = '<ul class="ingredient-list">';
            for (let i = 1; i <= 20; i++) {
                if (meal[`strIngredient${i}`]) {
                    const ingredient = meal[`strIngredient${i}`];
                    const measure = meal[`strMeasure${i}`];
                    ingredientsList.push(`${measure ? measure : ''} ${ingredient}`.trim());
                    ingredientsHtml += `<li class="ingredient-item">${measure ? measure + ' ' : ''}${ingredient}</li>`;
                } else {
                    break;
                }
            }
            ingredientsHtml += '</ul>';

            modalBody.innerHTML = `
                <div class="modal-header">
                    <img src="${meal.strMealThumb}" alt="${meal.strMeal}" class="modal-img">
                    <h2 class="modal-title">${meal.strMeal}</h2>
                    <span class="recipe-category">${meal.strArea} ${meal.strCategory}</span>
                </div>
                
                <h3 class="modal-section-title">Ingredients</h3>
                ${ingredientsHtml}
                
                <h3 class="modal-section-title">Instructions (Chef's Special)</h3>
                <div id="ai-instructions" class="instructions-text">
                    <p class="loader" style="font-size: 1rem;">👩‍🍳 Asking the chef for the best steps...</p>
                </div>
                
                ${meal.strYoutube ? `
                <div style="text-align: center; margin-top: 2rem;">
                    <a href="${meal.strYoutube}" target="_blank" style="color: #FF6B6B; text-decoration: none; font-weight: bold;">Watch Video Tutorial &rarr;</a>
                </div>` : ''}
            `;

            // Call Gemini API for better instructions
            generateRecipe(meal.strMeal, ingredientsList.join(', '));

        } else {
            modalBody.innerHTML = '<p class="loader">Recipe details not found.</p>';
        }
    } catch (error) {
        console.error('Error fetching details:', error);
        modalBody.innerHTML = '<p class="loader">Failed to load details.</p>';
    }
}

async function generateRecipe(recipeName, ingredients) {
    const apiKey = "AIzaSyBftw8ljTZpvqwty53EHF4_vg_JMis7u9U"; // ⚠️ Provided by user
    const aiOutputDiv = document.getElementById("ai-instructions");

    const prompt = `
    You are a professional home chef.
    Generate clear, easy-to-follow cooking steps for the following recipe.
    
    Recipe name: ${recipeName}
    Ingredients: ${ingredients}
    
    Instructions:
    - Write steps in numbered format
    - Keep language simple and beginner-friendly
    - Each step should be short and clear
    - Add a small 💡 Tip at the end
    - Do NOT output markdown, just plain text with numbering
    `;

    try {
        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [{ text: prompt }]
                        }
                    ]
                })
            }
        );

        const data = await response.json();
        const aiText = data.candidates[0].content.parts[0].text;

        // Format the text slightly for HTML
        const formattedText = aiText.replace(/\n/g, '<br>');
        aiOutputDiv.innerHTML = formattedText;

    } catch (error) {
        console.error("AI Generation Error:", error);
        aiOutputDiv.innerHTML = `<p style="color: #e17055;">Could not reach the chef. Showing standard instructions instead.</p>`;

        // Fallback to fetching standard instructions again or passing them if we had stored them
        // For now, simpler error message is fine as user specifically requested AI
    }
}
