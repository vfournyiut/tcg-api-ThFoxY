import bcrypt from "bcryptjs";
import {readFileSync} from "fs";
import {join} from "path";
import {prisma} from "../src/database";
import {CardModel} from "../src/generated/prisma/models/Card";
import {PokemonType} from "../src/generated/prisma/enums";

async function main() {
    console.log("🌱 Starting database seed...");

    await prisma.card.deleteMany();
    await prisma.user.deleteMany();
    // Supprime tous les decks et les liens avec les cartes
    await prisma.deck.deleteMany();
    await prisma.deckCard.deleteMany();

    const hashedPassword = await bcrypt.hash("password123", 10);

    await prisma.user.createMany({
        data: [
            {
                username: "red",
                email: "red@example.com",
                password: hashedPassword,
            },
            {
                username: "blue",
                email: "blue@example.com",
                password: hashedPassword,
            },
        ],
    });

    const redUser = await prisma.user.findUnique({where: {email: "red@example.com"}});
    const blueUser = await prisma.user.findUnique({where: {email: "blue@example.com"}});

    if (!redUser || !blueUser) {
        throw new Error("Failed to create users");
    }

    console.log("✅ Created users:", redUser.username, blueUser.username);

    const pokemonDataPath = join(__dirname, "data", "pokemon.json");
    const pokemonJson = readFileSync(pokemonDataPath, "utf-8");
    const pokemonData: CardModel[] = JSON.parse(pokemonJson);

    const createdCards = await Promise.all(
        pokemonData.map((pokemon) =>
            prisma.card.create({
                data: {
                    name: pokemon.name,
                    hp: pokemon.hp,
                    attack: pokemon.attack,
                    type: PokemonType[pokemon.type as keyof typeof PokemonType],
                    pokedexNumber: pokemon.pokedexNumber,
                    imgUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemon.pokedexNumber}.png`,
                },
            })
        )
    );

    console.log(`✅ Created ${pokemonData.length} Pokemon cards`);

    // Assigne 10 cartes aléatoires aux deux utilisateurs de test
    const users = [redUser, blueUser];
    // Pour chaque utilisateur créé, créer un deck de 10 cartes aléatoires
    for(const user of users) {
        // Fonction très intelligente qui choisit 10 cartes aléatoires
        /*
            Spread operator (...) permet de copier le tableau createdCards (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax)
            Sort(() => 0.5 - Math.random()) permet de trier le tableau de manière aléatoire
            Math.random() renvoie un nombre aléatoire entre 0 et 1
            Slice(0, 10) permet de prendre les 10 premiers éléments du tableau
        */
        const randomCards = [...createdCards].sort(() => 0.5 - Math.random()).slice(0, 10);
        // Création du deck
        await prisma.deck.create({
            data: {
                name: `${user.username}'s Starter Deck`,
                userId: user.id,
                // Création des liens entre le deck et les cartes
                cards: {
                    // Map permet d'itérer sur chaque carte aléatoire et de retourner un objet qui contient l'id de la carte
                    create: randomCards.map((randomCard) => {
                        return {
                            cardId: randomCard.id
                        }
                    })
                }
            },
        });
    }

    // Recherche les decks précedemment crées
    const redDeck = await prisma.deck.findMany({where: {name: "red's Starter Deck"}});
    const blueDeck = await prisma.deck.findMany({where: {name: "blue's Starter Deck"}});

    // Si aucun deck n'a été trouvé, lancer une erreur
    if (!redDeck || !blueDeck) {
        throw new Error("Failed to create decks");
    }

    // Affiche les decks créés
    console.log("✅ Created decks:", redDeck[0].name, blueDeck[0].name, redUser.username);

    // Recherche le nombre de cartes par deck
    const redDeckCards = await prisma.deckCard.findMany({where: {deckId: redUser.id}});
    const blueDeckCards = await prisma.deckCard.findMany({where: {deckId: blueUser.id}});

    // Affiche le nombre de cartes par deck
    console.log("✅ Number of cards per deck:", redDeckCards.length, blueDeckCards.length);

    console.log("\n🎉 Database seeding completed!");
}

main()
    .catch((e) => {
        console.error("❌ Error seeding database:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
