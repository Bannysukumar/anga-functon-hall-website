"use client"

import { useEffect, useState } from "react"
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"

type Campaign = {
  id: string
  name: string
  startDate: Timestamp
  endDate: Timestamp
  isActive: boolean
  doubleReferralRewards: boolean
  extraScratchCards: number
  cashbackMultiplier: number
}

export default function CampaignManagerPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [name, setName] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [doubleReferralRewards, setDoubleReferralRewards] = useState(false)
  const [extraScratchCards, setExtraScratchCards] = useState("0")
  const [cashbackMultiplier, setCashbackMultiplier] = useState("1")

  async function load() {
    const snap = await getDocs(query(collection(db, "campaigns"), orderBy("startDate", "desc")))
    setCampaigns(
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Campaign, "id">) }))
    )
  }
  useEffect(() => {
    load()
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Campaign Manager</h1>
      <Card>
        <CardHeader><CardTitle>Create Campaign</CardTitle></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-3">
          <Input placeholder="Campaign name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={doubleReferralRewards} onCheckedChange={(v) => setDoubleReferralRewards(Boolean(v))} />Double referral rewards</label>
          <Input type="number" placeholder="Extra scratch cards" value={extraScratchCards} onChange={(e) => setExtraScratchCards(e.target.value)} />
          <Input type="number" step="0.1" placeholder="Cashback multiplier" value={cashbackMultiplier} onChange={(e) => setCashbackMultiplier(e.target.value)} />
          <Button
            onClick={async () => {
              try {
                await addDoc(collection(db, "campaigns"), {
                  name,
                  startDate: Timestamp.fromDate(new Date(startDate)),
                  endDate: Timestamp.fromDate(new Date(endDate)),
                  isActive: true,
                  doubleReferralRewards,
                  extraScratchCards: Number(extraScratchCards || 0),
                  cashbackMultiplier: Number(cashbackMultiplier || 1),
                  createdAt: Timestamp.now(),
                })
                toast.success("Campaign created")
                setName("")
                setStartDate("")
                setEndDate("")
                setDoubleReferralRewards(false)
                setExtraScratchCards("0")
                setCashbackMultiplier("1")
                load()
              } catch {
                toast.error("Failed to create campaign")
              }
            }}
          >
            Create
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Active Campaigns</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {campaigns.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded border p-2 text-sm">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-muted-foreground">
                  {c.startDate?.toDate?.().toLocaleDateString("en-IN")} - {c.endDate?.toDate?.().toLocaleDateString("en-IN")}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={async () => {
                    await updateDoc(doc(db, "campaigns", c.id), { isActive: !c.isActive })
                    load()
                  }}
                >
                  {c.isActive ? "Disable" : "Enable"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    await deleteDoc(doc(db, "campaigns", c.id))
                    load()
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
