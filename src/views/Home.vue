<template>
  <div>
    <ChartComponent :chartData="chartData" />
  </div>
</template>

<script>
import ChartComponent from '@/components/ChartComponent.vue'

export default {
  components: {
    ChartComponent
  },
  data () {
    return {
      chartData: {
        labels: [],
        datasets: [
          {
            label: 'Remaining Data',
            backgroundColor: '#f87979',
            data: []
          }
        ]
      }
    }
  },
  async created () {
    const response = await fetch('https://gist.githubusercontent.com/yourusername/yourgistid/raw/yourgistfile.json')
    const data = await response.json()
    this.chartData.labels = data.map(entry => entry.date)
    this.chartData.datasets[0].data = data.map(entry => entry.remainingData)
  }
}
</script>