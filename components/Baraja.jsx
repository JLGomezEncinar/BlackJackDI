import { baraja } from "../assets/baraja/baraja";
import { Card } from './Card'

export default function Baraja() {
    return (
        baraja.map((card, index) => (
            <Card key={index} image={card.image} value={card.value} oculta={true} separada={false} />
        ))
    )
}
