<template>
  <div>
    <canvas id="dataChart"></canvas>
  </div>
</template>

<script>
import { Line } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale)

export default {
  extends: Line,
  props: {
    chartData: {
      type: Object,
      required: true
    }
  },
  mounted () {
    this.renderChart(this.chartData, { responsive: true, maintainAspectRatio: false })
  }
}
</script>