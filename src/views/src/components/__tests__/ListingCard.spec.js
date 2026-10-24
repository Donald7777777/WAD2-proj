import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ListingCard from '../ListingCard.vue'

const listing = {
  _id: '1',
  title: 'Canon AE-1',
  category: 'Cameras',
  condition: 'Excellent',
  lookingFor: 'film lenses',
  owner: { name: 'Theo' },
  status: 'available',
}

function mountCard(props, slots) {
  return mount(ListingCard, {
    props: { listing, ...props },
    slots,
    global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
  })
}

describe('ListingCard', () => {
  it('shows the listing details', () => {
    const wrapper = mountCard()
    expect(wrapper.text()).toContain('Canon AE-1')
    expect(wrapper.text()).toContain('Looking for: film lenses')
    expect(wrapper.text()).toContain('by Theo')
  })

  it('shows the match score and mutual badge', () => {
    const wrapper = mountCard({ score: 80, mutual: true })
    expect(wrapper.text()).toContain('80% match')
    expect(wrapper.text()).toContain('Mutual match')
  })

  it('renders buttons passed through the slot', () => {
    const wrapper = mountCard({}, { default: '<button>Edit</button>' })
    expect(wrapper.find('.card-footer button').text()).toBe('Edit')
  })
})
